/**
 * Provider policy for the OpenAI embedding pipeline (AI Discovery).
 *
 * WHY THIS EXISTS: which catalog sources may enter the embedding pipeline is a
 * deliberate, auditable decision rather than an implicit side effect of what
 * happens to be in the catalog. This is the ONE place that decision lives, so
 * `source === 'tmdb'` checks never scatter across scripts and the eval harness.
 *
 * TMDB SPECIFICALLY: the owner has clarified (per TMDB staff guidance in the
 * provided screenshot) that generating embeddings for semantic search over
 * cached TMDB metadata is acceptable for Favalog's described use. That
 * clarification is scoped to this use; it is not blanket approval of unrelated
 * uses or commercial licensing. Accordingly, TMDB rows are still EXCLUDED BY
 * DEFAULT and become embeddable ONLY when an operator explicitly turns the
 * dedicated embedding control on (see `isTmdbEmbeddingEnabled` in
 * `lib/catalog/feature-flag.ts`, which reads the server-only
 * `TMDB_EMBEDDING_ENABLED` flag). Enabling embeddings is independent from — and
 * does not by itself resolve — the separate question of whether the live TMDB
 * provider is enabled (`TMDB_ENABLED`).
 *
 * DESIGN: a strict ALLOWLIST that FAILS CLOSED. A source is embeddable only if
 * it is explicitly permitted — unconditionally for {@link EMBEDDABLE_SOURCES},
 * or conditionally (policy-gated) for {@link PROVIDER_GATED_EMBEDDABLE_SOURCES}.
 * An unknown, missing, blank, or newly-added source can never be embedded
 * silently.
 *
 * Pure and dependency-free (no I/O, no env, no secrets): the enablement DECISION
 * is read at the boundary and passed in as an {@link EmbeddingSourcePolicy}, so
 * this module stays safe to import from the embedding CLI core, the eval
 * harness, and tests.
 */

/**
 * The catalog sources that are ALWAYS embeddable, lower-cased and trimmed.
 *
 *   - `favalog`     curated/internal seed rows (the original AI Discovery corpus).
 *   - `openlibrary` books materialized from Open Library (no AI/ML use restriction
 *                   comparable to the current TMDB terms).
 *
 * Provider-gated sources (e.g. `tmdb`) are deliberately NOT listed here; see
 * {@link PROVIDER_GATED_EMBEDDABLE_SOURCES}.
 */
export const EMBEDDABLE_SOURCES = ["favalog", "openlibrary"] as const;

/**
 * Sources that are embeddable ONLY when their dedicated policy control is
 * explicitly enabled. `tmdb` is excluded by default and admitted solely when the
 * operator sets {@link EmbeddingSourcePolicy.tmdbEmbeddingEnabled}.
 */
export const PROVIDER_GATED_EMBEDDABLE_SOURCES = ["tmdb", "rawg"] as const;

/**
 * Whether the owner has documented permission to submit RAWG-derived content to
 * a LIVE (third-party) embedding provider. RAWG's terms permit personal use with
 * attribution, but embedding/caching clarification is unresolved, and TMDB's
 * staff clarification does NOT extend to RAWG. Until this is flipped in a
 * reviewed change that cites the documented permission, RAWG rows may only be
 * embedded with synthetic (fake) vectors, even when `RAWG_EMBEDDING_ENABLED` is
 * on. This is a code-level lock on purpose: an env var alone cannot enable it.
 */
export const RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED = false;

export type EmbeddableSource = (typeof EMBEDDABLE_SOURCES)[number];

/**
 * Explicit, serializable embedding-eligibility decisions. Read once at the
 * boundary (from env, via `lib/catalog/feature-flag.ts`) and threaded through so
 * this module performs no I/O of its own.
 */
export interface EmbeddingSourcePolicy {
  /**
   * Whether TMDB-sourced rows (`source = 'tmdb'`) may be embedded. Defaults to
   * `false` everywhere; only an operator's explicit opt-in flips it on.
   */
  tmdbEmbeddingEnabled: boolean;
  /**
   * Whether RAWG-sourced rows (`source = 'rawg'`) may be embedded. Independent
   * of the RAWG provider flag. Omitted means disabled.
   */
  rawgEmbeddingEnabled?: boolean;
  /**
   * Whether this run submits content to a LIVE embedding provider. Omitted is
   * treated as live (fail closed). Only a synthetic/fake run sets `false`.
   */
  liveSubmission?: boolean;
}

/**
 * The safe default policy: provider-gated sources stay OUT of the embedding
 * pipeline. Used whenever no explicit policy is supplied, so a caller that
 * forgets to pass one can never accidentally widen eligibility.
 */
export const DEFAULT_EMBEDDING_SOURCE_POLICY: EmbeddingSourcePolicy = {
  tmdbEmbeddingEnabled: false,
};

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
 * pipeline under `policy`. STRICT ALLOWLIST / DEFAULT DENY: returns `true` only
 * for an always-permitted source ({@link EMBEDDABLE_SOURCES}), or for a
 * policy-gated source when its control is explicitly enabled (currently only
 * `tmdb` via `policy.tmdbEmbeddingEnabled`). Everything else — an unknown/new
 * provider, or a missing/blank/non-string value — returns `false`, so a missing
 * policy entry can never silently allow embedding.
 */
export function isSourceEmbeddable(
  source: string | null | undefined,
  policy: EmbeddingSourcePolicy = DEFAULT_EMBEDDING_SOURCE_POLICY,
): boolean {
  const normalized = normalizeSource(source);
  if (EMBEDDABLE_SOURCE_SET.has(normalized)) return true;
  return classifyEmbeddingSource(normalized, policy) === "permitted";
}

/**
 * Machine-readable reason a source was excluded from embedding (safe to log;
 * never contains user content). `permitted` means the row IS embeddable.
 * `excluded_tmdb` means the row is TMDB and the TMDB embedding control is off.
 * `excluded_rawg` means the RAWG embedding control is off;
 * `excluded_rawg_live_permission_pending` means it is on, but this run would
 * submit to a live provider before RAWG embedding permission is documented.
 */
export type EmbeddingSourceDecision =
  | "permitted"
  | "excluded_tmdb"
  | "excluded_rawg"
  | "excluded_rawg_live_permission_pending"
  | "excluded_unknown";

/**
 * Explain the policy decision for one source. Used only for safe, aggregate
 * logging/telemetry — it carries the source token (a provider name, never user
 * content), so callers may surface counts by reason.
 */
export function classifyEmbeddingSource(
  source: string | null | undefined,
  policy: EmbeddingSourcePolicy = DEFAULT_EMBEDDING_SOURCE_POLICY,
): EmbeddingSourceDecision {
  const normalized = normalizeSource(source);
  if (EMBEDDABLE_SOURCE_SET.has(normalized)) return "permitted";
  if (normalized === "tmdb") {
    return policy.tmdbEmbeddingEnabled === true ? "permitted" : "excluded_tmdb";
  }
  if (normalized === "rawg") {
    if (policy.rawgEmbeddingEnabled !== true) return "excluded_rawg";
    const live = policy.liveSubmission !== false;
    if (live && !RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED) {
      return "excluded_rawg_live_permission_pending";
    }
    return "permitted";
  }
  return "excluded_unknown";
}

/**
 * Partition rows carrying a `source` into those that may be embedded under
 * `policy` and those excluded by it, preserving input order. Generic over any
 * row shape that exposes a `source` field so both the CLI core and the eval
 * harness can share one decision.
 */
export function partitionEmbeddableRows<
  T extends { source: string | null | undefined },
>(
  rows: readonly T[],
  policy: EmbeddingSourcePolicy = DEFAULT_EMBEDDING_SOURCE_POLICY,
): { embeddable: T[]; excluded: T[] } {
  const embeddable: T[] = [];
  const excluded: T[] = [];
  for (const row of rows) {
    (isSourceEmbeddable(row.source, policy) ? embeddable : excluded).push(row);
  }
  return { embeddable, excluded };
}
