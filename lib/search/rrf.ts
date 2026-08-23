/**
 * Reciprocal-rank fusion (RRF) — pure ranking logic, no I/O.
 *
 * RRF combines several independently ranked lists (here: a lexical/keyword arm
 * and a semantic/vector arm) into one ordering without needing the arms' raw,
 * non-comparable scores. Each list contributes `1 / (k + rank)` to every item
 * it ranks (rank is 1-based), and items are ordered by the summed contribution.
 *
 * The database `hybrid_search` function implements the same formula in SQL for
 * the live path; this TypeScript version is the single source of truth used by
 * the offline evaluation harness and is unit-tested directly (never mocked), so
 * the two implementations can be reasoned about against one shared definition.
 *
 * `k` (see {@link RRF_K}) dampens the influence of the very top ranks; a larger
 * `k` makes the fusion more egalitarian across arms.
 */

import { RRF_K } from "./config";

/** A single fused result: the item id and its accumulated RRF score. */
export interface FusedRank {
  id: string;
  score: number;
}

/**
 * Compute RRF scores for a set of ranked id-lists.
 *
 * @param rankings ordered lists of ids; index 0 is the best-ranked item.
 * @param k the RRF damping constant (defaults to {@link RRF_K}).
 * @returns a map of id -> summed RRF score.
 */
export function rrfScores(
  rankings: readonly (readonly string[])[],
  k: number = RRF_K,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    for (let index = 0; index < ranking.length; index++) {
      const id = ranking[index];
      const contribution = 1 / (k + index + 1); // rank is 1-based
      scores.set(id, (scores.get(id) ?? 0) + contribution);
    }
  }
  return scores;
}

/**
 * Fuse several ranked id-lists into one ordering by descending RRF score.
 *
 * Ties are broken deterministically by *earliest first appearance* across the
 * input lists (scanned in list order, then rank order), so the fusion is stable
 * and reproducible for a given input regardless of `Map` iteration quirks.
 */
export function fuseByRrf(
  rankings: readonly (readonly string[])[],
  k: number = RRF_K,
): FusedRank[] {
  const scores = rrfScores(rankings, k);

  // Deterministic tie-break key: the order in which ids are first encountered.
  const firstSeen = new Map<string, number>();
  let counter = 0;
  for (const ranking of rankings) {
    for (const id of ranking) {
      if (!firstSeen.has(id)) firstSeen.set(id, counter++);
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (firstSeen.get(a.id) ?? 0) - (firstSeen.get(b.id) ?? 0);
    });
}

/**
 * Apply exact-title protection to a fused ranking.
 *
 * A direct title query ("Dune: Part Two") must not be demoted below thematically
 * similar semantic matches. Given the ids whose title exactly matches the
 * (normalized) query, this promotes them to the front — preserving their
 * relative fused order — and leaves everything else untouched. Ids in
 * `exactTitleIds` that are not already in the fused list are prepended in the
 * given order so an exact hit is never lost.
 */
export function promoteExactTitles(
  fused: readonly FusedRank[],
  exactTitleIds: readonly string[],
): FusedRank[] {
  if (exactTitleIds.length === 0) return [...fused];
  const exact = new Set(exactTitleIds);

  const promoted: FusedRank[] = [];
  const rest: FusedRank[] = [];
  for (const entry of fused) {
    (exact.has(entry.id) ? promoted : rest).push(entry);
  }

  // Ensure exact hits missing from the fused pool are still represented,
  // in the caller-provided order, ahead of the rest.
  const present = new Set(promoted.map((entry) => entry.id));
  const missing: FusedRank[] = exactTitleIds
    .filter((id) => !present.has(id))
    .map((id) => ({ id, score: Number.POSITIVE_INFINITY }));

  return [...missing, ...promoted, ...rest];
}
