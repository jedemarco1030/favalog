/**
 * Central, documented configuration for Favalog's AI Discovery (hybrid catalog
 * retrieval) subsystem.
 *
 * Everything that governs embedding identity, ranking behaviour, and operational
 * limits lives here so there is exactly one place to reason about cost, latency,
 * reproducibility, and the security boundary. Nothing in this module reads a
 * secret or performs I/O — it is safe to import from anywhere (including tests
 * and the browser-free pure core), and it never throws at import time.
 *
 * IMPORTANT: the OpenAI API key is deliberately NOT read here. It is a
 * server-only secret (`process.env.OPENAI_API_KEY`) read only inside the
 * server-only provider adapter and the local embedding pipeline. It must never
 * be exposed through a `NEXT_PUBLIC_` variable, a browser bundle, Server Action
 * state, a log line, or an error message.
 */

/** The embedding model. Kept centralized so a change is a single, audited edit. */
export const EMBEDDING_MODEL = "text-embedding-3-small" as const;

/**
 * Embedding dimensionality. `text-embedding-3-small` natively returns 1536
 * dimensions; we request an explicit `dimensions: 512` (a Matryoshka-style
 * truncation the API supports) to cut vector storage and retrieval cost roughly
 * 3x while retaining strong retrieval quality for a small, controlled corpus.
 * This value is part of the embedding identity: it is stored on every row and a
 * change must trigger intentional re-embedding.
 */
export const EMBEDDING_DIMENSIONS = 512 as const;

/**
 * Stable identifier for the *provider* (not the model). Recorded on every
 * embedding row so a future provider swap is auditable and can drive
 * re-embedding. The internal {@link EmbeddingProvider} interface lets tests and
 * future providers avoid depending on OpenAI directly.
 */
export const EMBEDDING_PROVIDER_ID = "openai" as const;

/**
 * Reciprocal-rank-fusion constant. Larger values flatten the contribution of
 * top ranks; 60 is the widely used default from the original RRF paper and is a
 * sensible starting point for a small corpus. Centralized so ranking behaviour
 * is tunable in one audited place. Never accepted from the client.
 */
export const RRF_K = 60 as const;

/**
 * How many candidates each retrieval arm (keyword, semantic) contributes to the
 * fusion pool before the final limit is applied. Bounded to keep the database
 * work — and latency — predictable.
 */
export const KEYWORD_CANDIDATE_LIMIT = 50 as const;
export const SEMANTIC_CANDIDATE_LIMIT = 50 as const;

/** Default number of results returned to a caller when none is specified. */
export const DEFAULT_RESULT_LIMIT = 24 as const;

/**
 * Hard upper bound on results returned for any single query. The limit is
 * always server-controlled and clamped to this ceiling; a client can never ask
 * for an unbounded or larger result set.
 */
export const MAX_RESULT_LIMIT = 50 as const;

/** Maximum accepted query length (characters, after normalization). */
export const MAX_QUERY_LENGTH = 200 as const;

/**
 * Strict timeout for the single query-embedding request. If OpenAI is slow or
 * unreachable the search degrades to keyword-only rather than failing the page.
 */
export const EMBEDDING_TIMEOUT_MS = 2500 as const;

/** Bounded pipeline knobs — keep batch size, concurrency, and retries sane. */
export const PIPELINE_BATCH_SIZE = 16 as const;
export const PIPELINE_CONCURRENCY = 3 as const;
export const PIPELINE_MAX_RETRIES = 4 as const;
export const PIPELINE_RETRY_BASE_MS = 500 as const;
export const PIPELINE_RETRY_MAX_MS = 8000 as const;

/**
 * The three retrieval modes a search can resolve to. `keyword_fallback` is a
 * first-class outcome: it means semantic retrieval was attempted (enabled +
 * configured) but the embedding request timed out or failed, so keyword results
 * were returned instead of failing the request.
 */
export type SearchMode = "hybrid" | "keyword" | "keyword_fallback";

/** The allow-listed media-kind filter values Explore/search accept. */
export type SearchKindFilter = "all" | "movie" | "tv" | "book";

/**
 * Read the server-only kill switch for semantic retrieval.
 *
 * Returns `false` when `SEMANTIC_SEARCH_ENABLED` is explicitly set to a falsey
 * token (`false`/`0`/`off`/`no`), letting an operator disable the paid semantic
 * path *immediately* while keyword search keeps working — without a redeploy of
 * application logic. When the variable is unset the switch defaults to *on*, so
 * whether semantic actually runs then depends solely on whether an API key is
 * configured (see {@link isSemanticSearchConfigured}).
 *
 * This reads a plain (non-`NEXT_PUBLIC_`) variable and returns only a boolean,
 * so it never leaks configuration to the browser.
 */
export function isSemanticSearchEnabled(): boolean {
  const raw = process.env.SEMANTIC_SEARCH_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return !(raw === "false" || raw === "0" || raw === "off" || raw === "no");
}

/**
 * Whether the OpenAI-backed embedding provider is configured (a non-blank
 * `OPENAI_API_KEY` is present). Returns only a boolean and never the key.
 */
export function isSemanticSearchConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

/**
 * The single predicate the search service uses to decide whether to attempt the
 * semantic arm at all: the kill switch must be on AND a provider must be
 * configured. When this is false, retrieval runs keyword-only (mode
 * `keyword`), never `keyword_fallback` — no embedding request is even attempted.
 */
export function shouldAttemptSemanticSearch(): boolean {
  return isSemanticSearchEnabled() && isSemanticSearchConfigured();
}

/** Clamp a caller-supplied limit into `[1, MAX_RESULT_LIMIT]`. */
export function clampResultLimit(
  limit: number | undefined,
  fallback: number = DEFAULT_RESULT_LIMIT,
): number {
  const value =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.floor(limit)
      : fallback;
  if (value < 1) return 1;
  if (value > MAX_RESULT_LIMIT) return MAX_RESULT_LIMIT;
  return value;
}
