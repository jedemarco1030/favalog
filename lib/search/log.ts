/**
 * Structured, privacy-preserving operational telemetry for search.
 *
 * The emitted record is a VERSIONED, CLOSED event schema of safe, non-sensitive
 * fields. The raw (or normalized) user query, media title/slug, session/auth
 * tokens, user identity, provider API responses, and embedding vectors are
 * NEVER included. Only a coarse query LENGTH (not the text) and safe
 * categorical fields are recorded, so operators can reason about availability,
 * mode, latency, cost (tokens), and failures without leaking what anyone
 * searched for or which title they looked at.
 *
 * The schema is:
 *   - VERSIONED via {@link SEARCH_LOG_SCHEMA_VERSION} (bump on any field change
 *     so log consumers can detect and adapt to evolution), and
 *   - FIXED-NAME via {@link SEARCH_LOG_EVENT} (one stable event name).
 *
 * {@link buildSearchLog} returns the complete, closed event object (pure, easy
 * to unit-test for redaction); {@link logSearch} emits it as a single JSON
 * line. Emission is dependency-injected in the search service so tests never
 * require Vercel, OpenAI, or Supabase.
 */

import { randomUUID } from "node:crypto";

import type { EmbeddingErrorKind } from "./embedding-errors";
import type { SearchMode } from "./config";

/** The single, stable event name every search telemetry line carries. */
export const SEARCH_LOG_EVENT = "catalog_search" as const;

/**
 * Schema version of the closed search-telemetry event. This is the first
 * EXPLICITLY versioned schema; bump it whenever the emitted field set changes
 * so downstream consumers can detect and adapt to schema evolution.
 */
export const SEARCH_LOG_SCHEMA_VERSION = 1 as const;

/**
 * Why the search fell back to keyword-only (only set when it did).
 *
 * `incompatible_corpus` means the stored semantic corpus does not match the
 * server's expected embedding identity (provider/model/dimensions/document
 * version), so no compatible vectors exist to search — we stay keyword-only and
 * never pay for a query embedding.
 */
export type FallbackReason =
  "timeout" | "database" | "incompatible_corpus" | EmbeddingErrorKind;

/**
 * The safe, closed set of INPUT fields the search service supplies. These carry
 * only non-sensitive operational signals; the emitted event ({@link
 * SearchLogEvent}) adds the fixed event name, schema version, and derived
 * `zeroResult` on top.
 */
export interface SearchLogFields {
  /** Correlation id for tracing one request across log lines. */
  requestId: string;
  /** Resolved retrieval mode. */
  mode: SearchMode;
  /** Length (characters) of the normalized query — NEVER the query text. */
  queryLength: number;
  /** Allow-listed kind filter applied (`all` | `movie` | `tv` | `book`). */
  kind: string;
  /** Number of results returned. */
  resultCount: number;
  /**
   * Whether the semantic upgrade actually BEGAN. This is `true` only when the
   * keyword arm succeeded AND the configuration gate was eligible (kill switch
   * on and a provider configured), so the successful keyword path entered the
   * semantic upgrade starting with the compatible-corpus check. It stays
   * `false` when validation fails, Supabase is unavailable, semantic is
   * disabled/unconfigured, or keyword retrieval fails — none of which begin the
   * upgrade. An eligible-but-degraded run (e.g. an incompatible corpus) is a
   * true attempt, so it correctly reports `semanticAttempted: true` with
   * `compatibleCorpus: false`.
   */
  semanticAttempted: boolean;
  /**
   * Whether a compatible embedding corpus was observed (the compatibility check
   * returned a positive count). Only meaningful when `semanticAttempted` is
   * true; `false` otherwise, including when no positive compatible count was
   * observed.
   */
  compatibleCorpus: boolean;
  /** Embedding model identity, when the semantic arm ran. */
  embeddingModel?: string;
  /** Embedding token count, when reported (cost signal). */
  embeddingTokens?: number;
  /** Keyword-search database latency (ms). */
  keywordMs?: number;
  /** Compatibility-check latency (ms) — the `compatible_embedding_count` RPC. */
  compatMs?: number;
  /** Query-embedding latency (ms) — the single provider embedding request. */
  embeddingMs?: number;
  /** Hybrid-search database latency (ms) — the `hybrid_search` RPC. */
  hybridDbMs?: number;
  /** Total end-to-end latency (ms). */
  totalMs?: number;
  /** Coarse error category, when something failed safely. */
  errorCategory?: string;
  /** Reason keyword fallback was taken, when applicable. */
  fallbackReason?: FallbackReason;
}

/**
 * The complete, closed telemetry event as emitted. It is exactly {@link
 * SearchLogFields} plus the fixed event name, the schema version, and the
 * derived `zeroResult` boolean — and nothing else.
 */
export interface SearchLogEvent extends SearchLogFields {
  /** Fixed event name. */
  event: typeof SEARCH_LOG_EVENT;
  /** Closed-schema version. */
  schemaVersion: typeof SEARCH_LOG_SCHEMA_VERSION;
  /** Derived: whether the search returned zero results. */
  zeroResult: boolean;
}

/** Generate a correlation id for a search request. */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Build the closed, redacted telemetry event. This is the single audited choke
 * point: the input type already excludes sensitive fields, and this function
 * only ever copies allow-listed keys, derives `zeroResult`, and stamps the
 * fixed event name + schema version. It is a pure function tests assert against.
 */
export function buildSearchLog(fields: SearchLogFields): SearchLogEvent {
  return {
    event: SEARCH_LOG_EVENT,
    schemaVersion: SEARCH_LOG_SCHEMA_VERSION,
    requestId: fields.requestId,
    mode: fields.mode,
    queryLength: fields.queryLength,
    kind: fields.kind,
    resultCount: fields.resultCount,
    zeroResult: fields.resultCount === 0,
    semanticAttempted: fields.semanticAttempted,
    compatibleCorpus: fields.compatibleCorpus,
    ...(fields.embeddingModel !== undefined && {
      embeddingModel: fields.embeddingModel,
    }),
    ...(fields.embeddingTokens !== undefined && {
      embeddingTokens: fields.embeddingTokens,
    }),
    ...(fields.keywordMs !== undefined && { keywordMs: fields.keywordMs }),
    ...(fields.compatMs !== undefined && { compatMs: fields.compatMs }),
    ...(fields.embeddingMs !== undefined && {
      embeddingMs: fields.embeddingMs,
    }),
    ...(fields.hybridDbMs !== undefined && { hybridDbMs: fields.hybridDbMs }),
    ...(fields.totalMs !== undefined && { totalMs: fields.totalMs }),
    ...(fields.errorCategory !== undefined && {
      errorCategory: fields.errorCategory,
    }),
    ...(fields.fallbackReason !== undefined && {
      fallbackReason: fields.fallbackReason,
    }),
  };
}

/** Emit the closed search telemetry event as a single structured JSON line. */
export function logSearch(fields: SearchLogFields): void {
  console.info(JSON.stringify(buildSearchLog(fields)));
}
