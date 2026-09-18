// Favalog Catalog Platform — bounded periodic provider-metadata REFRESH worker
// (testable, dependency-injected core).
//
// Keeps ALREADY-MATERIALIZED provider-owned catalog rows (source = 'tmdb' |
// 'openlibrary') current by re-fetching each due record's trusted provider
// detail, normalizing it server-side, and applying the result through the
// service-role-only refresh RPCs added in
// 20260815121000_external_media_refresh_lifecycle.sql:
//
//   * refresh_external_media(...)             — apply a SUCCESSFUL fetch
//     (changed or unchanged) with optimistic-concurrency protection;
//   * mark_external_media_refresh_failed(...) — record a TRANSIENT failure;
//   * mark_external_media_removed(...)        — record a CONFIRMED removal.
//
// It NEVER imports, re-slugs, links, or hard-deletes anything: media id, slug,
// aliases, and every user-owned reference are preserved by the RPCs. This module
// only decides WHICH rows are due, fetches them under bounded concurrency /
// timeouts / per-run limits, classifies each outcome, and drives the correct
// RPC.
//
// SAFETY POSTURE (mirrors scripts/embed-catalog-core.ts and ADR 0003/0004):
//   - Only a live (non-dry-run) run writes anything, and only through the
//     narrow refresh RPCs.
//   - Remote (hosted) targets are guarded: a live remote run needs BOTH
//     --allow-remote AND --confirm-project-ref=<ref> matching the resolved URL.
//     --dry-run stays write-free everywhere.
//   - Provider activation is fail-closed: when the global kill switch or the
//     per-provider flag is off, NO provider request is made (clean no-op). When
//     a provider is enabled but its credential is unconfigured, the run aborts
//     BEFORE any request (nonzero) rather than silently degrading.
//   - Nothing here logs a key, a raw provider payload, a URL, or a vector.
//
// FRESHNESS TARGET. The default is a 7-day freshness window checked daily; this
// is an ENGINEERING DEFAULT for cost/latency, NOT a TMDB-prescribed interval,
// and is overridable with --freshness-days.
//
// All collaborators (env, provider registry, data-access store, clock, logger)
// are injected so the whole flow is unit-testable offline. The `.mjs`
// entrypoint is a thin wrapper that wires the real implementations.

import {
  authorizeEmbeddingWrite,
  classifyTarget,
  rowToMediaItem,
  type AuthorizationDecision,
  type MediaRow,
} from "./embed-catalog-core.ts";
import { canonicalDocumentFor } from "../lib/search/canonical-document.ts";
import {
  MAX_YEAR,
  MIN_YEAR,
  NORMALIZATION_VERSION,
} from "../lib/catalog/config.ts";
import { CatalogProviderError } from "../lib/catalog/errors.ts";
import type { ProviderErrorCategory } from "../lib/catalog/errors.ts";
import { buildDetails } from "../lib/catalog/materialize.ts";
import { normalizedContentHash } from "../lib/catalog/provenance.ts";
import type { ProviderRegistry } from "../lib/catalog/provider-registry";
import type {
  ExternalProvider,
  NormalizedMediaItem,
} from "../lib/catalog/types";
import type { MediaKind } from "../lib/types.ts";

// --- Bounds (server-controlled; a caller may only narrow, never widen) -------

/** Default freshness window (days). An engineering default, not TMDB-mandated. */
export const DEFAULT_FRESHNESS_DAYS = 7 as const;
/** Hard ceiling for the freshness window a caller may request. */
export const MAX_FRESHNESS_DAYS = 365 as const;
/** Default number of due rows processed per run. */
export const DEFAULT_LIMIT = 50 as const;
/** Hard ceiling on rows processed per run (bounded batch). */
export const MAX_LIMIT = 500 as const;
/** Default parallel provider fetches. */
export const DEFAULT_CONCURRENCY = 4 as const;
/** Hard ceiling on parallel provider fetches (bounded concurrency). */
export const MAX_CONCURRENCY = 8 as const;
/** Per-record provider-fetch timeout (ms). Defense in depth beside the HTTP layer. */
export const RECORD_TIMEOUT_MS = 15000 as const;

/** Tokens accepted as an explicit on/off for a boolean env flag (mirror feature-flag.ts). */
const TRUTHY_TOKENS = new Set(["true", "1", "on", "yes"]);
const FALSEY_TOKENS = new Set(["false", "0", "off", "no"]);

/** Parsed CLI arguments for the refresh worker. */
export interface RefreshArgs {
  provider: ExternalProvider;
  limit: number;
  concurrency: number;
  freshnessDays: number;
  dryRun: boolean;
  allowRemote: boolean;
  confirmProjectRef: string | undefined;
  json: boolean;
}

export type ParseResult =
  { ok: true; args: RefreshArgs } | { ok: false; error: string };

/** A concise, secret-free usage message printed on any invalid input. */
export const USAGE = [
  "Usage: node scripts/refresh-catalog.mjs [options]",
  "",
  "Refresh already-imported provider-owned catalog rows whose freshness window",
  "has elapsed (oldest-checked first), in bounded, resumable batches.",
  "",
  "Options:",
  "  --provider <tmdb|openlibrary>    Provider to refresh (default tmdb).",
  "  --limit <n> | --limit=<n>        Max due rows this run (1..500, default 50).",
  "  --concurrency <n>                Parallel fetches (1..8, default 4).",
  "  --freshness-days <n>             Freshness window in days (1..365, default 7).",
  "  --dry-run                        Read-only preview: provider reads, NO writes.",
  "  --allow-remote                   Permit a guarded remote (hosted) live run.",
  "  --confirm-project-ref <ref>      Confirm the exact hosted project reference.",
  "  --confirm-project-ref=<ref>      (same, `=` form)",
  "  --json                           Emit a machine-readable JSON summary.",
].join("\n");

/** Parse a bounded positive integer token, or null. */
function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Parse argv into {@link RefreshArgs}. Fail-closed: an unknown/misspelled flag,
 * a missing option value, an invalid number, an out-of-range bound, an empty
 * confirmation, a duplicated flag, or an unknown provider all return
 * `ok: false` so the caller exits nonzero. A typo can never be read as
 * permission to perform a write run.
 */
export function parseArgs(argv: readonly string[]): ParseResult {
  const args: RefreshArgs = {
    provider: "tmdb",
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    freshnessDays: DEFAULT_FRESHNESS_DAYS,
    dryRun: false,
    allowRemote: false,
    confirmProjectRef: undefined,
    json: false,
  };
  const seen = new Set<string>();
  const markSeen = (name: string): string | undefined =>
    seen.has(name)
      ? `Duplicate or conflicting option '${name}'.`
      : (seen.add(name), undefined);
  const needValue = (
    name: string,
    value: string | undefined,
  ): string | undefined =>
    value === undefined || value.startsWith("--")
      ? `Missing value for '${name}'.`
      : undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.dryRun = true;
    } else if (arg === "--allow-remote") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.allowRemote = true;
    } else if (arg === "--json") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      args.json = true;
    } else if (arg === "--provider") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      const value = argv[++i];
      if (value !== "tmdb" && value !== "openlibrary") {
        return { ok: false, error: `Unknown provider '${value}'.` };
      }
      args.provider = value;
    } else if (arg === "--limit" || arg.startsWith("--limit=")) {
      const dup = markSeen("--limit");
      if (dup) return { ok: false, error: dup };
      const raw = arg.startsWith("--limit=")
        ? arg.slice("--limit=".length)
        : ((): string | undefined => {
            const err = needValue("--limit", argv[i + 1]);
            if (err) return undefined;
            return argv[++i];
          })();
      if (raw === undefined)
        return { ok: false, error: "Missing value for '--limit'." };
      const value = parsePositiveInt(raw);
      if (value === null || value > MAX_LIMIT) {
        return {
          ok: false,
          error: `Invalid --limit '${raw}'; expected an integer in [1, ${MAX_LIMIT}].`,
        };
      }
      args.limit = value;
    } else if (arg === "--concurrency" || arg.startsWith("--concurrency=")) {
      const dup = markSeen("--concurrency");
      if (dup) return { ok: false, error: dup };
      const raw = arg.startsWith("--concurrency=")
        ? arg.slice("--concurrency=".length)
        : ((): string | undefined => {
            const err = needValue("--concurrency", argv[i + 1]);
            if (err) return undefined;
            return argv[++i];
          })();
      if (raw === undefined) {
        return { ok: false, error: "Missing value for '--concurrency'." };
      }
      const value = parsePositiveInt(raw);
      if (value === null || value > MAX_CONCURRENCY) {
        return {
          ok: false,
          error: `Invalid --concurrency '${raw}'; expected an integer in [1, ${MAX_CONCURRENCY}].`,
        };
      }
      args.concurrency = value;
    } else if (
      arg === "--freshness-days" ||
      arg.startsWith("--freshness-days=")
    ) {
      const dup = markSeen("--freshness-days");
      if (dup) return { ok: false, error: dup };
      const raw = arg.startsWith("--freshness-days=")
        ? arg.slice("--freshness-days=".length)
        : ((): string | undefined => {
            const err = needValue("--freshness-days", argv[i + 1]);
            if (err) return undefined;
            return argv[++i];
          })();
      if (raw === undefined) {
        return { ok: false, error: "Missing value for '--freshness-days'." };
      }
      const value = parsePositiveInt(raw);
      if (value === null || value > MAX_FRESHNESS_DAYS) {
        return {
          ok: false,
          error: `Invalid --freshness-days '${raw}'; expected an integer in [1, ${MAX_FRESHNESS_DAYS}].`,
        };
      }
      args.freshnessDays = value;
    } else if (arg === "--confirm-project-ref") {
      const dup = markSeen(arg);
      if (dup) return { ok: false, error: dup };
      const err = needValue(arg, argv[i + 1]);
      if (err) return { ok: false, error: err };
      const value = argv[++i];
      if (value.trim() === "") {
        return { ok: false, error: "Empty value for '--confirm-project-ref'." };
      }
      args.confirmProjectRef = value;
    } else if (arg.startsWith("--confirm-project-ref=")) {
      const dup = markSeen("--confirm-project-ref");
      if (dup) return { ok: false, error: dup };
      const value = arg.slice("--confirm-project-ref=".length);
      if (value.trim() === "") {
        return { ok: false, error: "Empty value for '--confirm-project-ref'." };
      }
      args.confirmProjectRef = value;
    } else {
      return { ok: false, error: `Unknown option '${arg}'.` };
    }
  }

  return { ok: true, args };
}

/** Read an explicit boolean env token with a documented default. */
function readBool(raw: string | undefined, defaultValue: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value === "") return defaultValue;
  if (TRUTHY_TOKENS.has(value)) return true;
  if (FALSEY_TOKENS.has(value)) return false;
  return defaultValue;
}

/** A provider's activation state derived from the INJECTED env (hermetic). */
export interface ProviderActivation {
  /** Global kill switch AND the per-provider flag are both on. */
  enabled: boolean;
  /** The provider's server-only credential is present (non-blank). */
  configured: boolean;
}

/**
 * Decide a provider's activation from the injected env, mirroring
 * `lib/catalog/feature-flag.ts` semantics but without touching `process.env`
 * so the worker stays hermetic and testable:
 *   - global `EXTERNAL_CATALOG_ENABLED` defaults OFF;
 *   - `TMDB_ENABLED` defaults OFF; `OPEN_LIBRARY_ENABLED` defaults ON;
 *   - configured means the credential env var is a non-blank string.
 */
export function providerActivation(
  env: Record<string, string | undefined>,
  provider: ExternalProvider,
): ProviderActivation {
  const externalOn = readBool(env.EXTERNAL_CATALOG_ENABLED, false);
  if (provider === "tmdb") {
    return {
      enabled: externalOn && readBool(env.TMDB_ENABLED, false),
      configured: (env.TMDB_API_READ_TOKEN ?? "").trim() !== "",
    };
  }
  return {
    enabled: externalOn && readBool(env.OPEN_LIBRARY_ENABLED, true),
    configured: (env.OPEN_LIBRARY_CONTACT_EMAIL ?? "").trim() !== "",
  };
}

/** A due provider-owned row selected for refresh (safe catalog fields only). */
export interface RefreshCandidateRow {
  mediaId: string;
  slug: string;
  source: ExternalProvider;
  kind: MediaKind;
  /** The stored DB `external_id` key (kind-qualified for TMDB, raw for OL). */
  externalId: string;
  /** The last stored content hash, used as the optimistic-concurrency baseline. */
  contentHash: string | null;
  /** The normalization version the stored row was produced under. */
  normalizationVersion: string | null;
}

/** Envelope mirroring supabase-js `{ data, error }`, with an optional SQLSTATE. */
export interface RpcEnvelope {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/**
 * Data-access seam. The `.mjs` entrypoint implements this over a service-role
 * Supabase client; tests supply a fake. Every method is read-only EXCEPT the
 * three RPC writers, which map 1:1 onto the migration's operator RPCs.
 */
export interface RefreshStore {
  /**
   * Try to acquire an exclusive, cross-process refresh lock (e.g. a Postgres
   * session advisory lock) so two workers never process concurrently. Returns
   * false when another run holds it.
   */
  acquireRunLock(): Promise<boolean>;
  /** Release the lock acquired by {@link acquireRunLock}. */
  releaseRunLock(): Promise<void>;
  /** Count rows currently due for `source` (freshness snapshot for reporting). */
  countDue(input: { source: string; cutoffIso: string }): Promise<number>;
  /** Select up to `limit` due rows for `source`, oldest-checked first. */
  selectDue(input: {
    source: string;
    cutoffIso: string;
    limit: number;
  }): Promise<RefreshCandidateRow[]>;
  /** Apply a successful provider fetch (refresh_external_media). */
  refresh(args: Record<string, unknown>): Promise<RpcEnvelope>;
  /** Record a transient failure (mark_external_media_refresh_failed). */
  markFailed(args: Record<string, unknown>): Promise<RpcEnvelope>;
  /** Record a confirmed removal (mark_external_media_removed). */
  markRemoved(args: Record<string, unknown>): Promise<RpcEnvelope>;
  /**
   * Invalidate a now-stale embedding after a content change: null the vector and
   * its provenance for `mediaId` UNLESS the stored embedded-document hash already
   * equals `freshDocumentHash` (an unchanged embedding input — e.g. a poster-only
   * refresh — or a concurrent re-embed that already wrote the fresh document).
   * Touches ONLY the private embedding store; never deletes the row, its
   * content, or any user data, and never affects keyword search. Returns how
   * many rows were invalidated (0 or 1).
   */
  invalidateStaleEmbedding(input: {
    mediaId: string;
    freshDocumentHash: string;
  }): Promise<{ invalidated: number; error: { message: string } | null }>;
}

/** Minimal logger surface (injected so tests stay quiet and assertable). */
export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/** All external dependencies injected into {@link runRefreshCatalog}. */
export interface RefreshDeps {
  env: Record<string, string | undefined>;
  buildRegistry: (opts: { fake: boolean }) => ProviderRegistry;
  createStore: (url: string, key: string) => RefreshStore;
  /** Wall clock (ms). Injected so freshness cutoffs are deterministic in tests. */
  now?: () => number;
  logger: Logger;
}

/** Structured, redacted per-run summary (safe to log). */
export interface RefreshSummary {
  provider: ExternalProvider;
  dryRun: boolean;
  /** Total rows due at the start of the run (freshness snapshot). */
  due: number;
  /** Rows attempted this run (bounded by --limit). */
  processed: number;
  /** Authoritative provider responses (changed + unchanged + removed). */
  checked: number;
  changed: number;
  unchanged: number;
  removed: number;
  /** Transient provider failures recorded (network/timeout/5xx/429). */
  unavailable: number;
  /** Non-transient failures recorded (validation/unknown/db write). */
  failed: number;
  /** Optimistic-concurrency rejections (a newer writer already advanced the row). */
  stale: number;
  /** Estimated rows still due after this run (resumable-progress hint). */
  remainingDue: number;
  /**
   * Stale embeddings invalidated this run because a content change altered the
   * canonical embedding document, so the previous vector is no longer served as
   * compatible until the embedding pipeline regenerates it. A poster-only or
   * rating-only change (excluded from the canonical document) never counts here.
   */
  embeddingsInvalidated: number;
}

/** Per-record outcome kinds accumulated into the summary. */
type OutcomeKind =
  "changed" | "unchanged" | "removed" | "unavailable" | "failed" | "stale";

/**
 * The result of processing one due row: the summary bucket it falls into, plus
 * whether it invalidated a now-stale embedding (only ever possible on a live
 * `changed` outcome whose embedding input actually differs).
 */
interface RefreshOneResult {
  kind: OutcomeKind;
  embeddingInvalidated: boolean;
}

/** The transient provider categories that map to the `unavailable` bucket. */
const TRANSIENT: ReadonlySet<ProviderErrorCategory> = new Set([
  "rate_limited",
  "unavailable",
  "timeout",
]);

/**
 * Derive the provider-native external id from the stored DB key. TMDB keys are
 * kind-qualified (`movie:603` -> `603`); Open Library Work ids are stored raw.
 */
export function providerNativeId(
  source: ExternalProvider,
  kind: MediaKind,
  storedExternalId: string,
): string {
  const prefix = `${kind}:`;
  if (source === "tmdb" && storedExternalId.startsWith(prefix)) {
    return storedExternalId.slice(prefix.length);
  }
  return storedExternalId;
}

/** Compute the freshness cutoff ISO timestamp: rows checked at/before it are due. */
export function computeCutoffIso(nowMs: number, freshnessDays: number): string {
  return new Date(nowMs - freshnessDays * 24 * 60 * 60 * 1000).toISOString();
}

/** Whether a normalized record's stored provenance differs from a fresh fetch. */
export function isContentChanged(
  row: RefreshCandidateRow,
  freshContentHash: string,
): boolean {
  return (
    row.contentHash !== freshContentHash ||
    row.normalizationVersion !== NORMALIZATION_VERSION
  );
}

/** Sentinel thrown to abort the whole run when a provider is unconfigured. */
class FatalConfigError extends Error {}

/** Build the refresh RPC argument object from a normalized fetch. */
function buildRefreshArgs(
  row: RefreshCandidateRow,
  item: NormalizedMediaItem,
  contentHash: string,
): Record<string, unknown> {
  return {
    p_source: row.source,
    p_kind: row.kind,
    p_external_id: row.externalId,
    p_title: item.title,
    p_subtitle: item.subtitle ?? null,
    p_synopsis: item.synopsis,
    p_year: item.year,
    p_poster_url: item.posterUrl ?? null,
    p_backdrop_url: item.backdropUrl ?? null,
    p_average_rating: item.averageRating ?? null,
    p_genres: item.genres,
    p_details: buildDetails(item),
    p_content_hash: contentHash,
    p_normalization_version: NORMALIZATION_VERSION,
    p_expected_content_hash: row.contentHash,
  };
}

/**
 * The canonical EMBEDDING-document hash for a refreshed record — the exact hash
 * the embedding pipeline stores next to a vector. It is built from the SAME
 * fields (title/subtitle/kind/year/genres/credits/synopsis) through the shared
 * `rowToMediaItem` + `canonicalDocumentFor`, so it agrees byte-for-byte with the
 * pipeline. It intentionally EXCLUDES poster/backdrop/rating/timestamps, so a
 * poster-only or rating-only refresh yields an unchanged hash and never
 * needlessly invalidates a good embedding.
 */
export function embeddingDocumentHash(
  row: RefreshCandidateRow,
  item: NormalizedMediaItem,
): string {
  const mediaRow: MediaRow = {
    id: row.mediaId,
    slug: row.slug,
    source: row.source,
    kind: row.kind,
    title: item.title,
    subtitle: item.subtitle ?? null,
    synopsis: item.synopsis,
    year: item.year,
    poster_url: item.posterUrl ?? null,
    genres: item.genres,
    details: buildDetails(item),
  };
  return canonicalDocumentFor(rowToMediaItem(mediaRow)).contentHash;
}

/** Guard a normalized fetch is safe to persist (title + plausible year). */
function isMaterializable(item: NormalizedMediaItem): boolean {
  return (
    typeof item.title === "string" &&
    item.title.trim() !== "" &&
    Number.isInteger(item.year) &&
    item.year >= MIN_YEAR &&
    item.year <= MAX_YEAR
  );
}

/** Fetch provider detail for one row under a bounded per-record timeout. */
async function fetchDetail(
  registry: ProviderRegistry,
  row: RefreshCandidateRow,
): Promise<NormalizedMediaItem> {
  const rawId = providerNativeId(row.source, row.kind, row.externalId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECORD_TIMEOUT_MS);
  try {
    return await registry
      .get(row.source)
      .getByExternalId(
        { provider: row.source, kind: row.kind, externalId: rawId },
        controller.signal,
      );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Process ONE due row and return the bucket it falls into. Never throws except
 * the {@link FatalConfigError} sentinel (unconfigured provider), which aborts
 * the whole run. All other failures are classified and (for a live run)
 * recorded through the correct RPC so a single bad record never stops the batch.
 */
async function refreshOne(
  row: RefreshCandidateRow,
  args: RefreshArgs,
  deps: RefreshDeps,
  store: RefreshStore,
  registry: ProviderRegistry,
): Promise<RefreshOneResult> {
  // Most outcomes never invalidate an embedding; only a live content change can.
  const bucket = (kind: OutcomeKind): RefreshOneResult => ({
    kind,
    embeddingInvalidated: false,
  });

  let item: NormalizedMediaItem;
  try {
    item = await fetchDetail(registry, row);
  } catch (error) {
    const category =
      error instanceof CatalogProviderError ? error.category : "unknown";

    // Unconfigured affects EVERY record; abort the run rather than churn.
    if (category === "not_configured") throw new FatalConfigError();

    // A confirmed provider removal is authoritative — soft-hide the row.
    if (category === "not_found") {
      if (args.dryRun) return bucket("removed");
      const { error: rpcError } = await store.markRemoved({
        p_source: row.source,
        p_kind: row.kind,
        p_external_id: row.externalId,
      });
      if (rpcError) return bucket("failed");
      return bucket("removed");
    }

    // Everything else is a NON-authoritative failure: record it transiently so
    // the record stays due for a later retry, and never treat it as removal.
    if (args.dryRun)
      return bucket(TRANSIENT.has(category) ? "unavailable" : "failed");
    const { error: rpcError } = await store.markFailed({
      p_source: row.source,
      p_kind: row.kind,
      p_external_id: row.externalId,
      p_error: category,
    });
    if (rpcError) return bucket("failed");
    return bucket(TRANSIENT.has(category) ? "unavailable" : "failed");
  }

  // A malformed provider payload (missing title / implausible year) is a data
  // failure, not a removal: record it transiently and keep the record due.
  if (!isMaterializable(item)) {
    if (args.dryRun) return bucket("failed");
    const { error: rpcError } = await store.markFailed({
      p_source: row.source,
      p_kind: row.kind,
      p_external_id: row.externalId,
      p_error: "validation",
    });
    if (rpcError) return bucket("failed");
    return bucket("failed");
  }

  const contentHash = normalizedContentHash(item);

  // Dry run: preview the outcome WITHOUT any write (including no invalidation).
  if (args.dryRun) {
    return bucket(isContentChanged(row, contentHash) ? "changed" : "unchanged");
  }

  const { data, error } = await store.refresh(
    buildRefreshArgs(row, item, contentHash),
  );
  if (error) {
    // P0005 = optimistic-concurrency rejection: a newer writer already advanced
    // the row, so our stale result is safely discarded (benign, not a failure).
    if (error.code === "P0005") return bucket("stale");
    // P0002 (unknown identity) / P0004 (curated) should not occur for a selected
    // provider row; any write error is a non-transient failure for this record.
    return bucket("failed");
  }

  const outcome =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).outcome
      : undefined;
  if (outcome !== "changed") return bucket("unchanged");

  // The content changed: invalidate any embedding whose embedded canonical
  // document no longer matches the fresh one, so the previous vector stops being
  // served/counted as compatible until the embedding pipeline regenerates it.
  // The store makes this a no-op when the embedding input is unchanged (e.g. a
  // poster-only refresh, which the canonical document excludes) or when a
  // concurrent re-embed already wrote the fresh document.
  const freshDocumentHash = embeddingDocumentHash(row, item);
  const { invalidated, error: invalidateError } =
    await store.invalidateStaleEmbedding({
      mediaId: row.mediaId,
      freshDocumentHash,
    });
  if (invalidateError) {
    // The authoritative content write already committed; a failed invalidation
    // is NON-fatal because the embedding pipeline independently re-embeds a
    // changed document (its stored hash no longer matches). Surface it for
    // observability without failing the record or disturbing keyword search.
    deps.logger.warn(
      `[refresh-catalog] embedding invalidation failed for ${row.slug} (${row.source}); ` +
        `the embedding pipeline will re-embed on its next run: ${invalidateError.message}`,
    );
    return { kind: "changed", embeddingInvalidated: false };
  }
  return { kind: "changed", embeddingInvalidated: invalidated > 0 };
}

/** Run an async worker over `items` with bounded concurrency, in index order. */
async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const width = Math.max(1, Math.min(concurrency, items.length));
  const runners = Array.from({ length: width }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/** Format the human-readable one-line summary (safe to log). */
function formatSummary(s: RefreshSummary): string {
  return (
    `[refresh-catalog] ${s.dryRun ? "DRY RUN — " : ""}${s.provider}: ` +
    `due ${s.due}, processed ${s.processed}, checked ${s.checked} ` +
    `(changed ${s.changed}, unchanged ${s.unchanged}, removed ${s.removed}), ` +
    `unavailable ${s.unavailable}, failed ${s.failed}, stale ${s.stale}, ` +
    `embeddings invalidated ${s.embeddingsInvalidated}, ` +
    `remaining due ${s.remainingDue}`
  );
}

/**
 * Orchestrate a bounded periodic refresh run and return a process exit code. All
 * side-effecting collaborators are injected, so this is fully unit-testable
 * without a real network or database. Never calls `process.exit`.
 *
 * Exit codes: 0 success or clean no-op; 1 fatal config/guard/IO error; 2 the run
 * completed but recorded per-record failures (transient or otherwise).
 */
export async function runRefreshCatalog(
  argv: readonly string[],
  deps: RefreshDeps,
): Promise<number> {
  const { env, logger } = deps;
  const nowMs = (deps.now ?? Date.now)();

  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    logger.error(`[refresh-catalog] ${parsed.error}`);
    logger.error(USAGE);
    return 1;
  }
  const args = parsed.args;

  // Provider activation gate (fail-closed) BEFORE any network or database I/O.
  const activation = providerActivation(env, args.provider);
  if (!activation.enabled) {
    logger.log(
      `[refresh-catalog] ${args.provider} refresh is disabled ` +
        `(EXTERNAL_CATALOG_ENABLED / ${args.provider === "tmdb" ? "TMDB_ENABLED" : "OPEN_LIBRARY_ENABLED"}); ` +
        `no provider requests made.`,
    );
    return 0;
  }
  if (!activation.configured) {
    logger.error(
      `[refresh-catalog] ${args.provider} is enabled but not configured ` +
        `(missing server-only credential); no provider requests made.`,
    );
    return 1;
  }

  // Resolve Supabase config (service-role).
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey =
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    logger.error(
      "[refresh-catalog] Missing Supabase config. Set SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY (service-role) to read the catalog and refresh rows.",
    );
    return 1;
  }

  // Classify + authorize the target (dry runs stay write-free; remote guarded).
  const classification = classifyTarget(url);
  logger.log(
    `[refresh-catalog] Target: ${classification.kind} — host ${classification.host || "unknown"}` +
      (classification.projectRef
        ? ` (project ref ${classification.projectRef})`
        : ""),
  );
  const decision: AuthorizationDecision = authorizeEmbeddingWrite({
    classification,
    fake: false,
    force: false,
    dryRun: args.dryRun,
    allowRemote: args.allowRemote,
    confirmProjectRef: args.confirmProjectRef,
  });
  if (!decision.allowed) {
    logger.error(
      `[refresh-catalog] ${decision.message} (reason: ${decision.reason})`,
    );
    return 1;
  }
  logger.log(`[refresh-catalog] ${decision.message}`);

  const store = deps.createStore(url, serviceKey);
  const registry = deps.buildRegistry({ fake: false });
  const cutoffIso = computeCutoffIso(nowMs, args.freshnessDays);

  // Overlap prevention: a live run takes an exclusive lock so two workers never
  // process concurrently. A dry run performs no writes, so it needs no lock.
  let locked = false;
  if (!args.dryRun) {
    locked = await store.acquireRunLock();
    if (!locked) {
      logger.log(
        "[refresh-catalog] Another refresh run holds the lock; exiting without work.",
      );
      return 0;
    }
  }

  try {
    const due = await store.countDue({ source: args.provider, cutoffIso });
    const rows = await store.selectDue({
      source: args.provider,
      cutoffIso,
      limit: args.limit,
    });

    const summary: RefreshSummary = {
      provider: args.provider,
      dryRun: args.dryRun,
      due,
      processed: rows.length,
      checked: 0,
      changed: 0,
      unchanged: 0,
      removed: 0,
      unavailable: 0,
      failed: 0,
      stale: 0,
      remainingDue: due,
      embeddingsInvalidated: 0,
    };

    let aborted = false;
    await runPool(rows, args.concurrency, async (row) => {
      if (aborted) return;
      let result: RefreshOneResult;
      try {
        result = await refreshOne(row, args, deps, store, registry);
      } catch (error) {
        if (error instanceof FatalConfigError) {
          aborted = true;
          return;
        }
        throw error;
      }
      summary[result.kind] += 1;
      if (result.embeddingInvalidated) summary.embeddingsInvalidated += 1;
    });

    if (aborted) {
      logger.error(
        `[refresh-catalog] ${args.provider} is not configured; aborted before completing.`,
      );
      return 1;
    }

    // `checked` counts authoritative provider responses; rows that left the due
    // window this run (checked + stale) reduce the resumable remaining estimate.
    summary.checked = summary.changed + summary.unchanged + summary.removed;
    const leftWindow = summary.checked + summary.stale;
    summary.remainingDue = Math.max(0, due - leftWindow);

    logger.log(formatSummary(summary));
    logger.log(JSON.stringify({ event: "refresh_catalog_report", ...summary }));

    return summary.failed + summary.unavailable > 0 ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[refresh-catalog] Stopped: ${message}`);
    return 1;
  } finally {
    if (locked) {
      try {
        await store.releaseRunLock();
      } catch {
        // Best-effort release; a session lock is freed when the connection ends.
      }
    }
  }
}
