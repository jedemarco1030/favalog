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
import type { EmbeddingProvider } from "../lib/search/embedding-provider.ts";
import type { MediaItem, TVShow } from "../lib/types.ts";
import type {
  EmbeddingRecord,
  EmbeddingStore,
  PipelineOptions,
  PipelineReport,
} from "../lib/search/pipeline.ts";

/** Parsed CLI arguments for the embedding pipeline. */
export interface EmbedArgs {
  dryRun: boolean;
  fake: boolean;
  force: boolean;
  limit: number | undefined;
  allowRemote: boolean;
  confirmProjectRef: string | undefined;
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
  kind: "movie" | "tv" | "book";
  title: string;
  subtitle: string | null;
  synopsis: string | null;
  year: number;
  poster_url?: string | null;
  genres: string[] | null;
  details: Record<string, unknown> | null;
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
    .select("id, slug, kind, title, subtitle, synopsis, year, genres, details")
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

  const records: EmbeddingRecord[] = ((rows as MediaRow[]) ?? []).map((row) => {
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
        `tokens ${report.tokens}, duration ${Math.round(report.durationMs)}ms`,
    );
    logger.log(JSON.stringify({ event: "embed_catalog_report", ...report }));
    return report.failed > 0 ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[embed-catalog] Stopped: ${message}`);
    return 1;
  }
}
