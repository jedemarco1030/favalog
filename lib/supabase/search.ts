/**
 * Server-only catalog search service.
 *
 * Orchestrates the hybrid retrieval flow with safe degradation:
 *
 *   1. Validate + normalize the query (empty/whitespace never calls OpenAI).
 *   2. If Supabase is unconfigured, report `unavailable` so the caller keeps the
 *      existing no-env public browsing behaviour.
 *   3. Always run deterministic keyword retrieval first.
 *   4. If semantic search is enabled AND configured, request ONE query embedding
 *      under a strict timeout, then run hybrid (RRF + exact-title) retrieval.
 *   5. If the embedding times out or fails — or the hybrid RPC errors — return
 *      the keyword results instead of failing the page (mode `keyword_fallback`).
 *
 * The resolved mode is recorded as `hybrid`, `keyword`, or `keyword_fallback`.
 * Only safe fields cross the boundary; the query text, tokens, vectors, and user
 * identity are never logged. All inputs are server-validated: no client-supplied
 * vectors, weights, model names, dimensions, or SQL fragments are ever accepted.
 *
 * Dependencies (Supabase client, provider factory, clock, logger) are injectable
 * so the flow can be unit-tested while mocking ONLY the provider boundary.
 */

import {
  DEFAULT_RESULT_LIMIT,
  EMBEDDING_TIMEOUT_MS,
  clampResultLimit,
  shouldAttemptSemanticSearch,
  type SearchMode,
} from "@/lib/search/config";
import { createOpenAIEmbeddingProvider } from "@/lib/search/openai-embedding-provider";
import type { EmbeddingProvider } from "@/lib/search/embedding-provider";
import {
  EmbeddingError,
  toSafeErrorCategory,
} from "@/lib/search/embedding-errors";
import {
  kindFilterToKind,
  parseKindFilter,
  validateQuery,
} from "@/lib/search/query";
import {
  buildSearchLog,
  logSearch,
  newRequestId,
  type FallbackReason,
  type SearchLogFields,
} from "@/lib/search/log";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";
import {
  mapSearchRowsToMediaItems,
  type SearchOutcome,
  type SearchRpcRow,
} from "./search-view-model";

/** The minimal Supabase surface the service needs (an `rpc` caller). */
interface SearchClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: SearchRpcRow[] | null;
    error: { message?: string } | null;
  }>;
}

/** Injectable dependencies (all optional; production defaults are used). */
export interface SearchDeps {
  /** Provide a Supabase client (defaults to the per-request SSR client). */
  getClient?: () => Promise<SearchClient>;
  /** Provide/override the embedding provider factory (defaults to OpenAI). */
  createProvider?: () =>
    | { ok: true; provider: EmbeddingProvider }
    | { ok: false; error: EmbeddingError };
  /** Whether the semantic arm should be attempted (defaults to the config gate). */
  attemptSemantic?: () => boolean;
  /** Monotonic clock in ms (defaults to performance.now). */
  now?: () => number;
  /** Structured logger (defaults to the redacted JSON logger). */
  log?: (fields: SearchLogFields) => void;
  /** Timeout for the query-embedding request (defaults to config). */
  embeddingTimeoutMs?: number;
}

/** Input to a catalog search. `limit` is server-clamped; kind is allow-listed. */
export interface SearchInput {
  query: unknown;
  kind?: unknown;
  limit?: number;
}

async function defaultGetClient(): Promise<SearchClient> {
  // The full typed client structurally provides `rpc`; the narrow interface
  // keeps this module testable without importing the whole client type.
  return (await createClient()) as unknown as SearchClient;
}

/**
 * Run a catalog search and return a discriminated {@link SearchOutcome}.
 */
export async function searchCatalog(
  input: SearchInput,
  deps: SearchDeps = {},
): Promise<SearchOutcome> {
  const now = deps.now ?? (() => performance.now());
  const log = deps.log ?? logSearch;
  const startedAt = now();
  const requestId = newRequestId();

  const validation = validateQuery(input.query);
  if (!validation.ok) {
    // Empty/invalid query: no search, no provider call.
    return { status: "empty" };
  }
  const query = validation.query;
  const kind = parseKindFilter(input.kind);
  const dbKind = kindFilterToKind(kind);
  const limit = clampResultLimit(input.limit, DEFAULT_RESULT_LIMIT);

  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  const client = await (deps.getClient ?? defaultGetClient)();

  // --- Keyword arm (always) -------------------------------------------------
  const kwStart = now();
  const keyword = await client.rpc("keyword_search", {
    p_query: query,
    p_kind: dbKind ?? undefined,
    p_limit: limit,
  });
  const keywordMs = now() - kwStart;

  if (keyword.error) {
    log(
      buildSearchLog({
        requestId,
        mode: "keyword",
        queryLength: query.length,
        kind,
        resultCount: 0,
        keywordMs,
        totalMs: now() - startedAt,
        errorCategory: "database",
      }),
    );
    return { status: "error", category: "database" };
  }

  let rows: SearchRpcRow[] = keyword.data ?? [];
  let mode: SearchMode = "keyword";
  let fallbackReason: FallbackReason | undefined;
  let embeddingModel: string | undefined;
  let embeddingTokens: number | undefined;
  let embeddingMs: number | undefined;
  let dbMs: number | undefined;

  // --- Semantic upgrade (best-effort) --------------------------------------
  const attemptSemantic = deps.attemptSemantic ?? shouldAttemptSemanticSearch;
  if (attemptSemantic()) {
    const providerResult = (
      deps.createProvider ?? createOpenAIEmbeddingProvider
    )();
    if (!providerResult.ok) {
      // Configured-but-unbuildable (e.g. key vanished): stay keyword-only.
      mode = "keyword_fallback";
      fallbackReason = providerResult.error.kind;
    } else {
      const timeoutMs = deps.embeddingTimeoutMs ?? EMBEDDING_TIMEOUT_MS;
      const embStart = now();
      try {
        const embedding = await providerResult.provider.embed([query], {
          signal: AbortSignal.timeout(timeoutMs),
        });
        embeddingMs = now() - embStart;
        embeddingModel = embedding.model;
        embeddingTokens = embedding.usage?.totalTokens;

        const vector = embedding.vectors[0];
        if (!vector)
          throw new EmbeddingError("unknown", "empty embedding vector");

        const hyStart = now();
        const hybrid = await client.rpc("hybrid_search", {
          p_query: query,
          p_query_embedding: JSON.stringify(vector),
          p_kind: dbKind ?? undefined,
          p_limit: limit,
        });
        dbMs = now() - hyStart;

        if (hybrid.error) {
          // DB failure on the hybrid arm: keep keyword results.
          mode = "keyword_fallback";
          fallbackReason = "database";
        } else {
          rows = hybrid.data ?? [];
          mode = "hybrid";
        }
      } catch (error) {
        embeddingMs = now() - embStart;
        mode = "keyword_fallback";
        fallbackReason =
          error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : toSafeErrorCategory(error);
      }
    }
  }

  const items = mapSearchRowsToMediaItems(rows).slice(0, limit);

  log(
    buildSearchLog({
      requestId,
      mode,
      queryLength: query.length,
      kind,
      resultCount: items.length,
      embeddingModel,
      embeddingTokens,
      keywordMs,
      embeddingMs,
      dbMs,
      totalMs: now() - startedAt,
      fallbackReason,
    }),
  );

  return {
    status: "ok",
    query,
    kind,
    mode,
    items,
    count: items.length,
    ...(fallbackReason !== undefined && { fallbackReason }),
  };
}
