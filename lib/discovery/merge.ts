import { hasProviderBackdrop } from "@/lib/media/artwork";
import type { DiscoveryCandidate } from "./types";

/**
 * Combining shelves from different providers. Provider popularity scores are
 * never compared: mixed shelves either order by a shared, objective key (a
 * stated release date) or interleave each provider's own ranking round-robin.
 */

/**
 * Merge several providers' candidates by release date. Only candidates with a
 * full stated date take part. Ties keep provider rank, then input order.
 */
export function mergeByReleaseDate(
  lists: ReadonlyArray<readonly DiscoveryCandidate[]>,
  direction: "asc" | "desc",
  limit: number,
): DiscoveryCandidate[] {
  const dated = lists.flatMap((list, listIndex) =>
    list
      .filter((c): c is DiscoveryCandidate & { releaseDate: string } =>
        Boolean(c.releaseDate),
      )
      .map((c) => ({ c, listIndex })),
  );
  dated.sort((a, b) => {
    const byDate =
      direction === "asc"
        ? a.c.releaseDate.localeCompare(b.c.releaseDate)
        : b.c.releaseDate.localeCompare(a.c.releaseDate);
    return byDate || a.c.rank - b.c.rank || a.listIndex - b.listIndex;
  });
  return dated.slice(0, limit).map(({ c }) => c);
}

/** Round-robin by each list's own order: first of each, then second of each… */
export function interleave(
  lists: ReadonlyArray<readonly DiscoveryCandidate[]>,
  limit: number,
): DiscoveryCandidate[] {
  const out: DiscoveryCandidate[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < limit; i++) {
    for (const list of lists) {
      if (list[i] && out.length < limit) out.push(list[i]);
    }
  }
  return out;
}

/** How many top-ranked titles per provider list are eligible for the banner. */
export const FEATURED_POOL_PER_LIST = 5;

/**
 * A stable daily featured pick: the top few titles WITH wide artwork from each
 * list, interleaved, then chosen by UTC day. Same pick all day, no rotation.
 */
export function pickDiscoveryFeatured(
  lists: ReadonlyArray<readonly DiscoveryCandidate[]>,
  dayIndex: number,
): DiscoveryCandidate | null {
  const pool = interleave(
    lists.map((list) =>
      list.filter(hasProviderBackdrop).slice(0, FEATURED_POOL_PER_LIST),
    ),
    Number.POSITIVE_INFINITY,
  );
  if (pool.length === 0) return null;
  const index = ((dayIndex % pool.length) + pool.length) % pool.length;
  return pool[index];
}
