/**
 * Provider policy for the OpenAI embedding pipeline (AI Discovery).
 *
 * WHY THIS EXISTS: the current TMDB API Terms broadly restrict using TMDB APIs
 * or TMDB content in connection with an AI/ML-based application. Favalog has NOT
 * obtained permission or licensing for that use, so — until the owner confirms
 * appropriate permission through TMDB's official API licensing/support channel —
 * TMDB-sourced catalog rows (`source = 'tmdb'`) MUST NOT enter the OpenAI
 * embedding pipeline. Excluding TMDB from embeddings does NOT by itself resolve
 * every licensing question; the production TMDB provider must additionally stay
 * disabled (see `lib/catalog/feature-flag.ts` / the TMDB enablement flag).
 *
 * DESIGN: this is the ONE place that decides which `media_items.source` values
 * are eligible for embedding, rather than scattering `source === 'tmdb'` checks
 * across scripts and the eval harness. It is a strict ALLOWLIST that fails
 * closed: a source is embeddable only if it is explicitly permitted here, so an
 * unknown, missing, blank, or newly-added source can never be embedded silently.
 *
 * Pure and dependency-free (no I/O, no env, no secrets); safe to import from the
 * embedding CLI core, the eval harness, and tests.
 */

/**
 * The catalog sources that MAY be embedded, lower-cased and trimmed.
 *
 *   - `favalog`     curated/internal seed rows (the original AI Discovery corpus).
 *   - `openlibrary` books materialized from Open Library (no AI/ML use restriction
 *                   comparable to the current TMDB terms).
 *
 * NOTE the deliberate ABSENCE of `tmdb`: TMDB rows are excluded by default. Do
 * not add a source here without a documented policy decision.
 */
export const EMBEDDABLE_SOURCES = ["favalog", "openlibrary"] as const;

/** A source that is present in the catalog but intentionally NOT embeddable. */
export const EMBEDDING_EXCLUDED_SOURCES = ["tmdb"] as const;

export type EmbeddableSource = (typeof EMBEDDABLE_SOURCES)[number];

const EMBEDDABLE_SOURCE_SET: ReadonlySet<string> = new Set(EMBEDDABLE_SOURCES);

/**
 * Normalize a raw `source` value for policy comparison. A non-string, `null`,
 * `undefined`, or whitespace-only value normalizes to the empty string, which is
 * never embeddable (fail closed).
 */
function normalizeSource(source: string | null | undefined): string {
  return typeof source === "string" ? source.trim().toLowerCase() : "";
}

/**
 * Whether a catalog row from the given `source` is allowed into the embedding
 * pipeline. STRICT ALLOWLIST / DEFAULT DENY: returns `true` ONLY for an
 * explicitly permitted source ({@link EMBEDDABLE_SOURCES}). Everything else —
 * `tmdb`, an unknown/new provider, or a missing/blank/non-string value —
 * returns `false`, so a missing policy entry can never silently allow embedding.
 */
export function isSourceEmbeddable(source: string | null | undefined): boolean {
  return EMBEDDABLE_SOURCE_SET.has(normalizeSource(source));
}

/**
 * Machine-readable reason a source was excluded from embedding (safe to log;
 * never contains user content). `permitted` means the row IS embeddable.
 */
export type EmbeddingSourceDecision =
  "permitted" | "excluded_tmdb" | "excluded_unknown";

/**
 * Explain the policy decision for one source. Used only for safe, aggregate
 * logging/telemetry — it carries the source token (a provider name, never user
 * content), so callers may surface counts by reason.
 */
export function classifyEmbeddingSource(
  source: string | null | undefined,
): EmbeddingSourceDecision {
  const normalized = normalizeSource(source);
  if (EMBEDDABLE_SOURCE_SET.has(normalized)) return "permitted";
  if (normalized === "tmdb") return "excluded_tmdb";
  return "excluded_unknown";
}

/**
 * Partition rows carrying a `source` into those that may be embedded and those
 * excluded by policy, preserving input order. Generic over any row shape that
 * exposes a `source` field so both the CLI core and the eval harness can share
 * one decision.
 */
export function partitionEmbeddableRows<
  T extends { source: string | null | undefined },
>(rows: readonly T[]): { embeddable: T[]; excluded: T[] } {
  const embeddable: T[] = [];
  const excluded: T[] = [];
  for (const row of rows) {
    (isSourceEmbeddable(row.source) ? embeddable : excluded).push(row);
  }
  return { embeddable, excluded };
}
