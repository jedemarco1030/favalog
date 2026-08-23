/**
 * Query normalization, validation, and filter parsing for catalog search.
 *
 * These are pure functions with no I/O. They enforce the server-side input
 * contract that protects the paid semantic path and the database:
 *
 *   - A query must be a string.
 *   - It is normalized (whitespace-collapsed, trimmed) before use.
 *   - An empty / whitespace-only query is rejected WITHOUT ever calling OpenAI.
 *   - A query longer than {@link MAX_QUERY_LENGTH} is rejected.
 *   - The media-kind filter is strictly allow-listed; anything else is `all`.
 *
 * No client-supplied vectors, weights, model names, dimensions, or SQL fragments
 * are accepted anywhere — the only inputs are a text query, an allow-listed
 * kind, and (elsewhere) a server-clamped limit.
 */

import { MAX_QUERY_LENGTH, type SearchKindFilter } from "./config";

/** Why a query failed validation. `empty` guarantees no provider call happens. */
export type QueryRejectionReason = "not_a_string" | "empty" | "too_long";

/** The result of validating a raw query input. */
export type QueryValidation =
  { ok: true; query: string } | { ok: false; reason: QueryRejectionReason };

/** Collapse internal whitespace and trim. Safe on any string. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Validate and normalize a raw, untrusted query value.
 *
 * Accepts `unknown` because it may come straight from a URL parameter or form
 * field. Returns a discriminated result so callers can branch without throwing.
 */
export function validateQuery(raw: unknown): QueryValidation {
  if (typeof raw !== "string") return { ok: false, reason: "not_a_string" };
  const query = normalizeQuery(raw);
  if (query.length === 0) return { ok: false, reason: "empty" };
  if (query.length > MAX_QUERY_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, query };
}

/** The allow-listed kind filters, in a set for O(1) membership checks. */
const VALID_KIND_FILTERS: ReadonlySet<SearchKindFilter> = new Set([
  "all",
  "movie",
  "tv",
  "book",
]);

/**
 * Parse an untrusted media-kind filter (e.g. a URL parameter) into an
 * allow-listed {@link SearchKindFilter}. Anything unrecognised — including
 * arrays, unknown strings, or `undefined` — collapses to `all`.
 */
export function parseKindFilter(raw: unknown): SearchKindFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof value === "string" &&
    VALID_KIND_FILTERS.has(value as SearchKindFilter)
  ) {
    return value as SearchKindFilter;
  }
  return "all";
}

/**
 * The concrete media kind a filter narrows to, or `null` for `all` (no
 * narrowing). Handy when passing an optional kind to the database layer.
 */
export function kindFilterToKind(
  filter: SearchKindFilter,
): "movie" | "tv" | "book" | null {
  return filter === "all" ? null : filter;
}
