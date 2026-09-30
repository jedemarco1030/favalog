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

/** Status of the documented permission to send RAWG content to a live embedder. */
export type RawgEmbeddingPermissionStatus = "unresolved" | "documented";

/** A cited, reviewable record of the evidence behind the RAWG embedding gate. */
export interface RawgEmbeddingPermissionRecord {
  status: RawgEmbeddingPermissionStatus;
  reviewedOn: string;
  sources: readonly { url: string; relevantText: string }[];
  /** Why the evidence does not (yet) permit live embedding. */
  assessment: string;
  /** The exact question that, if answered yes in writing, resolves the gate. */
  outstandingQuestion: string;
}

/**
 * The evidence behind the RAWG live-embedding gate. Owner authorization to show
 * games in hybrid search is a product decision, NOT RAWG permission, and TMDB's
 * staff clarification does not extend to RAWG. Flipping `status` to
 * `documented` requires a reviewed change that adds RAWG's written answer (or a
 * terms revision) to `sources`.
 */
export const RAWG_EMBEDDING_PERMISSION: RawgEmbeddingPermissionRecord = {
  status: "unresolved",
  reviewedOn: "2026-09-29",
  sources: [
    {
      url: "https://rawg.io/apidocs",
      relevantText:
        "Free for personal use as long as you attribute RAWG ... No data " +
        "redistribution ... you may use the data with your API access only " +
        "for your projects.",
    },
    {
      url: "https://rawg.io/tos_api",
      relevantText:
        "§6.2: no parts of the Services or the Content may be copied, " +
        "reproduced, ... transmitted or otherwise sent (including copied) to " +
        "another computer, server, website or any other data medium for " +
        "publication, distribution or any other commercial purpose ... " +
        "without our prior express written consent. §4.3(5): not to use " +
        "Services for the purposes of further distribution in any way.",
    },
  ],
  assessment:
    "The terms are silent on caching, derived vectors, and third-party " +
    "processors. Sending game metadata to OpenAI's embedding API transmits " +
    "RAWG Content to another server, which §6.2 restricts for commercial " +
    "purposes without written consent; whether Favalog's use qualifies is " +
    "not established by the published terms.",
  outstandingQuestion:
    "May Favalog send RAWG game metadata (title, year, genres, developers, " +
    "publishers, platforms, and the RAWG description) to a third-party " +
    "embedding API (OpenAI) and store the resulting vectors in Favalog's own " +
    "database, used only to rank search results inside Favalog and never " +
    "redistributed or exposed?",
};

/**
 * Whether live RAWG embedding is permitted. Derived from the evidence record so
 * an env var alone can never enable it; RAWG rows may only be embedded with
 * synthetic (fake) vectors while the record is `unresolved`.
 */
export const RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED: boolean =
  RAWG_EMBEDDING_PERMISSION.status === "documented";

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
 * Every known source that is embeddable under `policy` (always-on plus enabled
 * gated sources). Used by the eval harness so its completeness gate counts the
 * same corpus the pipeline would embed.
 */
export function embeddableSourcesFor(
  policy: EmbeddingSourcePolicy = DEFAULT_EMBEDDING_SOURCE_POLICY,
): string[] {
  return [...EMBEDDABLE_SOURCES, ...PROVIDER_GATED_EMBEDDABLE_SOURCES].filter(
    (source) => isSourceEmbeddable(source, policy),
  );
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
