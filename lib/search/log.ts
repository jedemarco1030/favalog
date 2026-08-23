/**
 * Structured, privacy-preserving operational logging for search.
 *
 * The log record is intentionally a CLOSED shape of safe, non-sensitive fields.
 * The raw user query, session/auth tokens, user identity, provider API
 * responses, and embedding vectors are NEVER included. Only a coarse query
 * LENGTH (not the text) and safe categorical fields are recorded, so operators
 * can reason about mode, latency, cost (tokens), and failures without leaking
 * what anyone searched for.
 *
 * {@link buildSearchLog} returns the plain object (pure, easy to unit-test for
 * redaction); {@link logSearch} emits it as a single JSON line.
 */

import { randomUUID } from "node:crypto";

import type { EmbeddingErrorKind } from "./embedding-errors";
import type { SearchMode } from "./config";

/** Why the search fell back to keyword-only (only set when it did). */
export type FallbackReason = "timeout" | "database" | EmbeddingErrorKind;

/** The safe, closed set of fields a search log line may contain. */
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
  /** Embedding model identity, when the semantic arm ran. */
  embeddingModel?: string;
  /** Embedding token count, when reported (cost signal). */
  embeddingTokens?: number;
  /** Latency breakdown in milliseconds. */
  keywordMs?: number;
  embeddingMs?: number;
  dbMs?: number;
  totalMs?: number;
  /** Coarse error category, when something failed safely. */
  errorCategory?: string;
  /** Reason keyword fallback was taken, when applicable. */
  fallbackReason?: FallbackReason;
}

/** Generate a correlation id for a search request. */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Build the redacted log record. This is deliberately the identity of its input
 * (the type already excludes sensitive fields), but exists as a single audited
 * choke point and a pure function tests can assert against.
 */
export function buildSearchLog(fields: SearchLogFields): SearchLogFields {
  return {
    requestId: fields.requestId,
    mode: fields.mode,
    queryLength: fields.queryLength,
    kind: fields.kind,
    resultCount: fields.resultCount,
    ...(fields.embeddingModel !== undefined && {
      embeddingModel: fields.embeddingModel,
    }),
    ...(fields.embeddingTokens !== undefined && {
      embeddingTokens: fields.embeddingTokens,
    }),
    ...(fields.keywordMs !== undefined && { keywordMs: fields.keywordMs }),
    ...(fields.embeddingMs !== undefined && {
      embeddingMs: fields.embeddingMs,
    }),
    ...(fields.dbMs !== undefined && { dbMs: fields.dbMs }),
    ...(fields.totalMs !== undefined && { totalMs: fields.totalMs }),
    ...(fields.errorCategory !== undefined && {
      errorCategory: fields.errorCategory,
    }),
    ...(fields.fallbackReason !== undefined && {
      fallbackReason: fields.fallbackReason,
    }),
  };
}

/** Emit the redacted search log as a single structured JSON line. */
export function logSearch(fields: SearchLogFields): void {
  console.info(
    JSON.stringify({ event: "catalog_search", ...buildSearchLog(fields) }),
  );
}
