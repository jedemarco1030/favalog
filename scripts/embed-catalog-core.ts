// Favalog AI Discovery — embedding pipeline core (testable, dependency-injected).
//
// This module holds the drift- and safety-critical logic of the catalog
// embedding CLI so it can be unit-tested without touching a real network or a
// hosted database:
//
//   1. Argument parsing (`parseArgs`).
//   2. Supabase target classification (`classifyTarget`) — is the resolved URL a
//      LOCAL Supabase (localhost / 127.0.0.1 / the documented local endpoint) or
//      a REMOTE hosted project?
//   3. The write-authorization guard (`authorizeEmbeddingWrite`) that decides,
//      deterministically and with NO interactive prompt, whether a run is
//      allowed to mutate the target's embeddings.
//   4. The orchestration (`runEmbedCatalog`) wired entirely through injected
//      dependencies so the thin `.mjs` entrypoint stays a wrapper.
//
// Security posture (see the AGENTS.md AI Discovery rules and ADR 0003):
//   - A REMOTE `--fake` write is ALWAYS rejected (even with `--force`); fake
//     vectors must never reach a hosted corpus.
//   - A REMOTE live write is rejected UNLESS the operator explicitly supplies
//     BOTH `--allow-remote` AND `--confirm-project-ref=<ref>` whose value
//     matches the project reference resolved from the Supabase URL.
//   - `--force` never bypasses remote protection.
//   - Remote dry runs stay write-free and clearly label the remote target.
//   - Authorization is NEVER inferred from the mere presence of a service key.
//   - Nothing here logs a key, a raw vector, or any secret.

import {
  CANONICAL_DOCUMENT_VERSION,
  canonicalDocumentFor,
} from "../lib/search/canonical-document.ts";
import {
  isRawgEmbeddingEnabled,
  isTmdbEmbeddingEnabled,
} from "../lib/catalog/feature-flag.ts";
import {
  classifyEmbeddingSource,
  EMBEDDABLE_SOURCES,
  type EmbeddingSourcePolicy,
  partitionEmbeddableRows,
  PROVIDER_GATED_EMBEDDABLE_SOURCES,
  RAWG_EMBEDDING_PERMISSION,
  RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED,
} from "../lib/search/embedding-source-policy.ts";
import type { EmbeddingProvider } from "../lib/search/embedding-provider.ts";
import type { MediaItem, TVShow } from "../lib/types.ts";
import {
  estimateTokens,
  type EmbeddingRecord,
  type EmbeddingStore,
  type PipelineOptions,
  type PipelineReport,
} from "../lib/search/pipeline.ts";

/**
 * List price used for dry-run cost estimates (OpenAI text-embedding-3-small,
 * USD per 1M input tokens). An estimate only; confirm current pricing before a
 * large hosted backfill.
 */
export const EMBEDDING_PRICE_USD_PER_MILLION_TOKENS = 0.02;

/** Cost estimate in USD for a token count, at the list price above. */
export function estimateCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * EMBEDDING_PRICE_USD_PER_MILLION_TOKENS;
}

/** Sources the `--source` flag accepts. */
const KNOWN_SOURCES: readonly string[] = [
  ...EMBEDDABLE_SOURCES,
  ...PROVIDER_GATED_EMBEDDABLE_SOURCES,
];

/** Parsed CLI arguments for the embedding pipeline. */
export interface EmbedArgs {
  dryRun: boolean;
  fake: boolean;
  force: boolean;
  limit: number | undefined;
  allowRemote: boolean;
  confirmProjectRef: string | undefined;
  /** Restrict the run to one catalog source (e.g. `rawg`). */
  source: string | undefined;
  /** Cap on stale rows embedded this run (resumable bounded backfill). */
  maxEmbed: number | undefined;
}

/**
 * The outcome of {@link parseArgs}: either the validated arguments or a safe,
 * secret-free error message explaining the first problem encountered.
 */
export type ParseResult =
  { ok: true; args: EmbedArgs } | { ok: false; error: string };

/**
 * A concise, secret-free usage message printed on any invalid input. It lists
 * only the supported option forms and never echoes an environment value or key.
 */
export const USAGE = [
  "Usage: node scripts/embed-catalog.mjs [options]",
  "",
  "Supported options:",
  "  --dry-run                        Preview without writing (no OpenAI key needed).",
  "  --fake                           Use deterministic FAKE local vectors (dev only).",
  "  --force                          Re-embed every row (recovery only).",
  "  --limit <n> | --limit=<n>        Cap catalog rows processed (positive integer).",
  "  --max-embed <n> | --max-embed=<n>  Cap stale rows embedded this run (resumable).",
  "  --source <s> | --source=<s>      Only this source: favalog, openlibrary, tmdb, rawg.",
  "  --allow-remote                   Permit a guarded remote (hosted) live write.",
  "  --confirm-project-ref <ref>      Confirm the exact hosted project reference.",
  "  --confirm-project-ref=<ref>      (same, `=` form)",
].join("\n");

/**
 * Validate a `--limit` token. Accepts ONLY a positive base-10 integer; a
 * non-integer, decimal, zero, negative, or non-numeric value returns `null`.
 */
function parseLimit(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

/**
 * Parse `process.argv`-style tokens into {@link EmbedArgs}. Deterministic and
 * side-effect free so it is safe to unit test.
 *
 * SAFETY-CRITICAL: invalid input is REJECTED rather than silently ignored. An
 * unknown/misspelled flag (e.g. a typo like `--dryrun`), a missing option value,
 * an invalid limit, an empty project reference, or a duplicated option all fail
 * with `ok: false` so the caller can exit nonzero. This prevents a typo from
 * ever being interpreted as permission to perform a normal (write) run.
 */
export function parseArgs(argv: readonly string[]): ParseResult {
  const args: EmbedArgs = {
    dryRun: false,
    fake: false,
    force: false,
    limit: undefined,
    allowRemote: false,
    confirmProjectRef: undefined,
    source: undefined,
    maxEmbed: undefined,
  };
  const seen = new Set<string>();
  const markSeen = (name: string): string | undefined =>
    seen.has(name)
      ? `Duplicate or conflicting option '${name}'.`
      : (seen.add(name), undefined);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      const dup = markSeen("--dry-run");
      if (dup) return { ok: false, error: dup };
      args.dryRun = true;
    } else if (arg === "--fake") {
      const dup = markSeen("--fake");
      if (dup) return { ok: false, error: dup };
      args.fake = true;
    } else if (arg === "--force") {
      const dup = markSeen("--force");
      if (dup) return { ok: false, error: dup };
      args.force = true;
    } else if (arg === "--allow-remote") {
      const dup = markSeen("--allow-remote");
      if (dup) return { ok: false, error: dup };
      args.allowRemote = true;
    } else if (arg === "--limit") {
      const dup = markSeen("--limit");
      if (dup) return { ok: false, error: dup };
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, error: "Missing value for '--limit'." };
      }
      i++;
      const parsed = parseLimit(value);
      if (parsed === null) {
        return {
          ok: false,
          error: `Invalid --limit value '${value}'; expected a positive integer.`,
        };
      }
      args.limit = parsed;
    } else if (arg.startsWith("--limit=")) {
      const dup = markSeen("--limit");
      if (dup) return { ok: false, error: dup };
      const value = arg.slice("--limit=".length);
      const parsed = parseLimit(value);
      if (parsed === null) {
        return {
          ok: false,
          error: `Invalid --limit value '${value}'; expected a positive integer.`,
        };
      }
      args.limit = parsed;
    } else if (arg === "--confirm-project-ref") {
      const dup = markSeen("--confirm-project-ref");
      if (dup) return { ok: false, error: dup };
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          ok: false,
          error: "Missing value for '--confirm-project-ref'.",
        };
      }
      i++;
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
    } else if (arg === "--max-embed" || arg.startsWith("--max-embed=")) {
      const dup = markSeen("--max-embed");
      if (dup) return { ok: false, error: dup };
      let value: string | undefined;
      if (arg === "--max-embed") {
        value = argv[i + 1];
        if (value === undefined || value.startsWith("--")) {
          return { ok: false, error: "Missing value for '--max-embed'." };
        }
        i++;
      } else {
        value = arg.slice("--max-embed=".length);
      }
      const parsed = parseLimit(value);
      if (parsed === null) {
        return {
          ok: false,
          error: `Invalid --max-embed value '${value}'; expected a positive integer.`,
        };
      }
      args.maxEmbed = parsed;
    } else if (arg === "--source" || arg.startsWith("--source=")) {
      const dup = markSeen("--source");
      if (dup) return { ok: false, error: dup };
      let value: string | undefined;
      if (arg === "--source") {
        value = argv[i + 1];
        if (value === undefined || value.startsWith("--")) {
          return { ok: false, error: "Missing value for '--source'." };
        }
        i++;
      } else {
        value = arg.slice("--source=".length);
      }
      if (!KNOWN_SOURCES.includes(value)) {
        return {
          ok: false,
          error: `Invalid --source value '${value}'; expected one of ${KNOWN_SOURCES.join(", ")}.`,
        };
      }
      args.source = value;
    } else {
      return { ok: false, error: `Unknown option '${arg}'.` };
    }
  }

  return { ok: true, args };
}

/** How a resolved Supabase URL is classified for write-safety decisions. */
export type TargetKind = "local" | "remote" | "unknown";

export interface TargetClassification {
  /** `local` (safe), `remote` (hosted, guarded), or `unknown` (treated as remote). */
  kind: TargetKind;
  /** Hostname only — safe to log. Empty when the URL could not be parsed. */
  host: string;
  /**
   * Project reference for a hosted `<ref>.supabase.co` URL (safe to log), or
   * `undefined` for local / unrecognized hosts. Used to require an exact
   * operator confirmation before any remote live write.
   */
  projectRef: string | undefined;
}

/** Hostnames that unambiguously identify a LOCAL Supabase stack. */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
]);

/**
 * Classify a Supabase URL as local or remote WITHOUT contacting it. A local
 * target is `localhost`, `127.0.0.1`, the IPv6 loopback, or the documented
 * local Supabase API endpoint (which listens on `127.0.0.1:54321`). A
 * `<ref>.supabase.co` / `.supabase.in` host is remote and yields its project
 * reference. Anything else is `unknown` and treated as remote by the guard.
 *
 * Only the hostname (and, for hosted URLs, the project ref) is retained — never
 * credentials embedded in the URL.
 */
export function classifyTarget(rawUrl: string): TargetClassification {
  let host = "";
  try {
    const parsed = new URL(rawUrl);
    host = parsed.hostname;
  } catch {
    return { kind: "unknown", host: "", projectRef: undefined };
  }

  const normalizedHost = host.toLowerCase();
  if (LOCAL_HOSTS.has(normalizedHost)) {
    return { kind: "local", host, projectRef: undefined };
  }

  // Hosted Supabase projects are `<project-ref>.supabase.co` (or `.supabase.in`).
  const hostedMatch = /^([a-z0-9-]+)\.supabase\.(co|in)$/i.exec(normalizedHost);
  if (hostedMatch) {
    return { kind: "remote", host, projectRef: hostedMatch[1] };
  }

  // Any other host (custom domain, proxy, IP, etc.) is treated conservatively
  // as remote so the safe default is to REQUIRE explicit confirmation.
  return { kind: "unknown", host, projectRef: undefined };
}

/** The outcome of the write-authorization guard. */
export interface AuthorizationDecision {
  /** Whether the run may proceed to the pipeline. */
  allowed: boolean;
  /** Whether the run is permitted to perform actual writes (false for dry runs). */
  writesPermitted: boolean;
  /** Stable machine-readable reason code (safe to log). */
  reason: string;
  /** Human-readable explanation (safe to log; never contains secrets). */
  message: string;
}

/**
 * Decide — deterministically, with no prompt — whether a run may write to the
 * classified target. See the module header for the full policy. This function
 * is pure: it reads only its arguments and returns a decision.
 */
export function authorizeEmbeddingWrite(input: {
  classification: TargetClassification;
  fake: boolean;
  force: boolean;
  dryRun: boolean;
  allowRemote: boolean;
  confirmProjectRef: string | undefined;
}): AuthorizationDecision {
  const { classification, fake, dryRun, allowRemote, confirmProjectRef } =
    input;

  // A dry run performs no writes anywhere, so it is always allowed to proceed —
  // but it must never be permitted to mutate the target.
  if (dryRun) {
    return {
      allowed: true,
      writesPermitted: false,
      reason: "dry_run",
      message: `Dry run against ${describeTarget(classification)} — no writes.`,
    };
  }

  // Local targets keep their existing behavior for both fake and live writes.
  if (classification.kind === "local") {
    return {
      allowed: true,
      writesPermitted: true,
      reason: "local_write",
      message: `Local target (${classification.host}) — writes permitted.`,
    };
  }

  // Everything below is a remote/unknown target — guarded.

  // Fake vectors must NEVER be written to a remote corpus, even with --force.
  if (fake) {
    return {
      allowed: false,
      writesPermitted: false,
      reason: "remote_fake_forbidden",
      message:
        `Refusing to write FAKE embeddings to remote target ` +
        `(${describeTarget(classification)}). Fake vectors must never reach a ` +
        `hosted corpus; --force does not override this.`,
    };
  }

  // Remote live write requires BOTH explicit flags.
  if (!allowRemote) {
    return {
      allowed: false,
      writesPermitted: false,
      reason: "remote_not_allowed",
      message:
        `Refusing remote live write to ${describeTarget(classification)}: ` +
        `pass --allow-remote and --confirm-project-ref=<ref> to proceed.`,
    };
  }

  if (!confirmProjectRef) {
    return {
      allowed: false,
      writesPermitted: false,
      reason: "remote_confirmation_missing",
      message:
        `Refusing remote live write to ${describeTarget(classification)}: ` +
        `--confirm-project-ref=<ref> is required.`,
    };
  }

  // The confirmation must match the project reference resolved from the URL.
  // An unknown host has no resolvable ref, so it can never be confirmed.
  if (
    classification.projectRef === undefined ||
    confirmProjectRef !== classification.projectRef
  ) {
    return {
      allowed: false,
      writesPermitted: false,
      reason: "remote_confirmation_mismatch",
      message:
        `Refusing remote live write: --confirm-project-ref does not match the ` +
        `resolved target (${describeTarget(classification)}).`,
    };
  }

  return {
    allowed: true,
    writesPermitted: true,
    reason: "remote_confirmed",
    message:
      `Confirmed remote live write to ${describeTarget(classification)} ` +
      `(project ref matched).`,
  };
}

/** A short, secret-free description of a target for logging. */
function describeTarget(classification: TargetClassification): string {
  if (classification.kind === "local") return `local:${classification.host}`;
  if (classification.projectRef) {
    return `remote:${classification.host} (ref ${classification.projectRef})`;
  }
  return `remote:${classification.host || "unknown-host"}`;
}

/** A media_items row shape (only the fields the document builder needs). */
export interface MediaRow {
  id: string;
  slug: string;
  /**
   * Catalog provenance (`favalog` | `openlibrary` | `tmdb` | ...). Drives the
   * provider embedding policy: TMDB rows are excluded by default and never
   * enter the OpenAI pipeline (see `lib/search/embedding-source-policy.ts`).
   */
  source: string | null;
  kind: "movie" | "tv" | "book" | "game";
  title: string;
  subtitle: string | null;
  synopsis: string | null;
  year: number;
  poster_url?: string | null;
  genres: string[] | null;
  details: Record<string, unknown> | null;
  /** Set when the provider confirmed removal; removed rows are never embedded. */
  provider_removed_at?: string | null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Build a MediaItem-shaped object from a media_items row for the doc builder. */
export function rowToMediaItem(row: MediaRow): MediaItem {
  const details =
    row.details && typeof row.details === "object" ? row.details : {};
  const d = details as Record<string, unknown>;
  const base = {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    synopsis: row.synopsis ?? "",
    year: row.year,
    posterUrl: row.poster_url ?? "",
    genres: Array.isArray(row.genres) ? row.genres : [],
  };
  if (row.kind === "movie") {
    return {
      ...base,
      kind: "movie" as const,
      runtimeMinutes: (d.runtimeMinutes as number) ?? 0,
      director: (d.director as string) ?? "",
      cast: Array.isArray(d.cast) ? (d.cast as string[]) : [],
    };
  }
  if (row.kind === "tv") {
    return {
      ...base,
      kind: "tv" as const,
      seasons: (d.seasons as number) ?? 0,
      episodes: (d.episodes as number) ?? 0,
      creators: Array.isArray(d.creators) ? (d.creators as string[]) : [],
      status: (d.status as TVShow["status"]) ?? "ongoing",
    };
  }
  if (row.kind === "game") {
    return {
      ...base,
      kind: "game" as const,
      platforms: stringList(d.platforms),
      developers: stringList(d.developers),
      publishers: stringList(d.publishers),
    };
  }
  return {
    ...base,
    kind: "book" as const,
    authors: Array.isArray(d.authors) ? (d.authors as string[]) : [],
    pageCount: (d.pageCount as number) ?? 0,
    publisher: (d.publisher as string) ?? undefined,
  };
}

/** Minimal logger surface (injected so tests stay quiet and assertable). */
export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/** A minimal Supabase-client surface used by the pipeline core. */
export interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        opts: { ascending: boolean },
      ) => {
        limit: (
          n: number,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      } & Promise<{ data: unknown; error: { message: string } | null }>;
    } & Promise<{ data: unknown; error: { message: string } | null }>;
    upsert: (
      values: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
}

/** All external dependencies injected into {@link runEmbedCatalog}. */
export interface EmbedDeps {
  env: Record<string, string | undefined>;
  createSupabaseClient: (url: string, key: string) => SupabaseLike;
  createFakeProvider: () => EmbeddingProvider;
  createOpenAIProvider: () =>
    { ok: true; provider: EmbeddingProvider } | { ok: false; reason?: string };
  runPipeline: (
    records: EmbeddingRecord[],
    store: EmbeddingStore,
    provider: EmbeddingProvider,
    options: PipelineOptions,
  ) => Promise<PipelineReport>;
  logger: Logger;
}

/**
 * Orchestrate a catalog embedding run and return a process exit code. All
 * side-effecting collaborators are injected, so this is fully unit-testable
 * without a real network or database. Never calls `process.exit` directly.
 *
 * Exit codes: 0 success (or clean no-op), 1 fatal config/guard/IO error,
 * 2 pipeline completed with per-row failures.
 */
export async function runEmbedCatalog(
  argv: readonly string[],
  deps: EmbedDeps,
): Promise<number> {
  const { env, logger } = deps;

  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    logger.error(`[embed-catalog] ${parsed.error}`);
    logger.error(USAGE);
    return 1;
  }
  const args = parsed.args;

  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey =
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    logger.error(
      "[embed-catalog] Missing Supabase config. Set SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY (service-role) to read the catalog and write embeddings.",
    );
    return 1;
  }

  // Classify the target and print ONLY safe classification info (never keys).
  const classification = classifyTarget(url);
  logger.log(
    `[embed-catalog] Target: ${classification.kind} — host ${classification.host || "unknown"}` +
      (classification.projectRef
        ? ` (project ref ${classification.projectRef})`
        : ""),
  );

  // Authorize the run BEFORE resolving any provider or contacting the database.
  const decision = authorizeEmbeddingWrite({
    classification,
    fake: args.fake,
    force: args.force,
    dryRun: args.dryRun,
    allowRemote: args.allowRemote,
    confirmProjectRef: args.confirmProjectRef,
  });
  if (!decision.allowed) {
    logger.error(
      `[embed-catalog] ${decision.message} (reason: ${decision.reason})`,
    );
    return 1;
  }
  logger.log(`[embed-catalog] ${decision.message}`);

  // A live RAWG write is refused outright (rather than silently embedding zero
  // rows) while the permission evidence is unresolved.
  if (
    args.source === "rawg" &&
    !args.fake &&
    !args.dryRun &&
    !RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED
  ) {
    logger.error(
      "[embed-catalog] Refusing a live RAWG embedding run: RAWG permission is " +
        `${RAWG_EMBEDDING_PERMISSION.status} (reviewed ` +
        `${RAWG_EMBEDDING_PERMISSION.reviewedOn}). Outstanding question for ` +
        `RAWG: ${RAWG_EMBEDDING_PERMISSION.outstandingQuestion}`,
    );
    return 1;
  }

  // Resolve the embedding provider (or exit cleanly when no key + not dry/fake).
  let provider: EmbeddingProvider;
  if (args.fake) {
    provider = deps.createFakeProvider();
    logger.warn(
      "[embed-catalog] Using the DETERMINISTIC FAKE provider (dev only).",
    );
  } else {
    const providerResult = deps.createOpenAIProvider();
    if (!providerResult.ok) {
      if (args.dryRun) {
        provider = deps.createFakeProvider();
      } else {
        // A real (non-dry-run, non-fake) embedding run with no usable OpenAI
        // provider is a FAILURE, never a silent clean no-op: exit nonzero so
        // automation cannot mistake a missing key for a successful embed.
        logger.error(
          "[embed-catalog] OPENAI_API_KEY is not configured or unusable. Set it " +
            "to embed, or run with --dry-run to preview, or --fake for " +
            "deterministic local vectors.",
        );
        return 1;
      }
    } else {
      provider = providerResult.provider;
    }
  }

  const supabase = deps.createSupabaseClient(url, serviceKey);

  // Read the catalog.
  const queryBuilder = supabase
    .from("media_items")
    .select(
      "id, slug, source, kind, title, subtitle, synopsis, year, genres, " +
        "details, provider_removed_at",
    )
    .order("slug", { ascending: true });
  const query = Number.isFinite(args.limit as number)
    ? queryBuilder.limit(args.limit as number)
    : queryBuilder;

  const { data: rows, error: readError } = await query;
  if (readError) {
    logger.error(
      `[embed-catalog] Failed to read catalog: ${readError.message}`,
    );
    return 1;
  }

  // Provider embedding policy (single decision point): only allow-listed
  // sources may be embedded. TMDB rows are excluded BY DEFAULT and admitted only
  // when the operator explicitly enables the dedicated `TMDB_EMBEDDING_ENABLED`
  // control (read here from the injected env, so tests stay hermetic); an
  // unknown/blank source is always excluded (fail closed). This filter is
  // applied to EVERY run — including a guarded remote (hosted) live backfill —
  // so no re-embedding command can embed a policy-excluded row.
  const policy: EmbeddingSourcePolicy = {
    tmdbEmbeddingEnabled: isTmdbEmbeddingEnabled(env),
    rawgEmbeddingEnabled: isRawgEmbeddingEnabled(env),
    liveSubmission: !args.fake,
  };
  const readRows = (rows as MediaRow[]) ?? [];
  const sourceRows = args.source
    ? readRows.filter((row) => row.source === args.source)
    : readRows;
  // Provider-confirmed removals are never (re)embedded; search already hides
  // them, and their user records are preserved on the row itself.
  const allRows = sourceRows.filter((row) => !row.provider_removed_at);
  const removedCount = sourceRows.length - allRows.length;
  if (removedCount > 0) {
    logger.log(
      `[embed-catalog] Skipped ${removedCount} provider-removed row(s).`,
    );
  }
  const { embeddable, excluded } = partitionEmbeddableRows(allRows, policy);

  // Planning aid: in a live dry run, report what a RAWG backfill WOULD cost
  // once permission is documented, without admitting those rows to the run.
  if (args.dryRun && !args.fake && !RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED) {
    const blockedRawg = allRows.filter((row) => row.source === "rawg");
    if (blockedRawg.length > 0) {
      const tokens = blockedRawg.reduce(
        (sum, row) =>
          sum +
          estimateTokens(canonicalDocumentFor(rowToMediaItem(row)).document),
        0,
      );
      logger.log(
        `[embed-catalog] RAWG blocked pending permission: ${blockedRawg.length} ` +
          `eligible game(s), ~${tokens} tokens, ~$${estimateCostUsd(tokens).toFixed(4)} ` +
          `(upper bound; includes rows that may already be fresh).`,
      );
    }
  }
  if (excluded.length > 0) {
    const byReason = new Map<string, number>();
    for (const row of excluded) {
      const reason = classifyEmbeddingSource(row.source, policy);
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    }
    const summary = Array.from(byReason.entries())
      .map(([reason, count]) => `${reason}=${count}`)
      .join(", ");
    logger.log(
      `[embed-catalog] Provider policy excluded ${excluded.length} row(s) from ` +
        `embedding (${summary}). Unknown sources are never embedded; TMDB is ` +
        `embedded only when TMDB_EMBEDDING_ENABLED is set; RAWG only when ` +
        `RAWG_EMBEDDING_ENABLED is set, and only with --fake until live RAWG ` +
        `embedding permission is documented.`,
    );
  }

  const records: EmbeddingRecord[] = embeddable.map((row) => {
    const { document, contentHash } = canonicalDocumentFor(rowToMediaItem(row));
    return { mediaId: row.id, slug: row.slug, document, contentHash };
  });

  const store: EmbeddingStore = {
    async loadExisting() {
      const { data, error } = await supabase
        .from("media_search_documents")
        .select(
          "media_id, content_hash, document_version, embedding_provider, " +
            "embedding_model, embedding_dimensions, embedded_at",
        );
      if (error) throw new Error(`loadExisting failed: ${error.message}`);
      const existing = new Map();
      for (const row of (data as Record<string, unknown>[]) ?? []) {
        existing.set(row.media_id, {
          contentHash: row.content_hash,
          hasEmbedding: row.embedded_at !== null,
          provider: row.embedding_provider ?? null,
          model: row.embedding_model ?? null,
          dimensions: row.embedding_dimensions ?? null,
          documentVersion: row.document_version ?? null,
        });
      }
      return existing;
    },
    async upsert(rowToWrite) {
      // Defense in depth: even if a dry run reached here, never mutate.
      if (!decision.writesPermitted) {
        throw new Error(
          "upsert blocked: writes are not permitted for this run",
        );
      }
      const { error } = await supabase.from("media_search_documents").upsert(
        {
          media_id: rowToWrite.mediaId,
          content: rowToWrite.content,
          content_hash: rowToWrite.contentHash,
          document_version: rowToWrite.documentVersion,
          embedding: JSON.stringify(rowToWrite.embedding),
          embedding_model: rowToWrite.model,
          embedding_provider: rowToWrite.provider,
          embedding_dimensions: rowToWrite.dimensions,
          embedded_at: rowToWrite.embeddedAt,
        },
        { onConflict: "media_id" },
      );
      if (error) throw new Error(`upsert failed: ${error.message}`);
    },
  };

  try {
    const report = await deps.runPipeline(records, store, provider, {
      dryRun: args.dryRun,
      force: args.force,
      maxEmbed: args.maxEmbed,
      documentVersion: CANONICAL_DOCUMENT_VERSION,
      onProgress: ({ batch, batches, updated, failed }) => {
        logger.log(
          `[embed-catalog] batch ${batch}/${batches} — updated ${updated}, failed ${failed}`,
        );
      },
    });

    logger.log(
      `[embed-catalog] ${args.dryRun ? "DRY RUN — " : ""}done: ` +
        `attempted ${report.attempted}, updated ${report.updated}, ` +
        `unchanged ${report.unchanged}, failed ${report.failed}, ` +
        `tokens ${report.tokens}, duration ${Math.round(report.durationMs)}ms` +
        (report.deferred
          ? `, deferred ${report.deferred} (re-run to resume)`
          : ""),
    );
    const eligibleBySource: Record<string, number> = {};
    for (const row of embeddable) {
      const key = `${row.source}/${row.kind}`;
      eligibleBySource[key] = (eligibleBySource[key] ?? 0) + 1;
    }
    const estimatedCostUsd =
      report.estimatedTokens !== undefined
        ? Number(estimateCostUsd(report.estimatedTokens).toFixed(6))
        : undefined;
    if (estimatedCostUsd !== undefined) {
      logger.log(
        `[embed-catalog] eligible ${embeddable.length} title(s); estimated ` +
          `~${report.estimatedTokens} tokens, ~$${estimatedCostUsd.toFixed(4)} ` +
          `at $${EMBEDDING_PRICE_USD_PER_MILLION_TOKENS}/1M tokens.`,
      );
    }
    logger.log(
      JSON.stringify({
        event: "embed_catalog_report",
        ...report,
        eligible: embeddable.length,
        eligibleBySource,
        ...(estimatedCostUsd !== undefined && { estimatedCostUsd }),
      }),
    );
    return report.failed > 0 ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[embed-catalog] Stopped: ${message}`);
    return 1;
  }
}
