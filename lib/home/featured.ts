import type { MediaItem } from "@/lib/types";

/**
 * Editorially curated featured titles for the Home banner, by stable slug.
 *
 * This is an editor's selection, NOT a popularity or trending signal, and the
 * banner labels it that way. The list deliberately spans all four media types.
 * Slugs missing from the catalog are skipped, so editing this list can never
 * break Home.
 */
export const FEATURED_SLUGS: readonly string[] = [
  "hades",
  "dune-part-two",
  "northlight",
  "the-bright-index",
  "afterglow",
  "harbour-lines",
  "avengers-endgame",
];

export interface FeaturedPick {
  item: MediaItem;
  /** `true` when the pick came from {@link FEATURED_SLUGS}. */
  curated: boolean;
}

const MS_PER_DAY = 86_400_000;

/** Whole UTC days since the epoch — rotates the pick once per day, stably. */
export function utcDayIndex(now: Date): number {
  return Math.floor(now.getTime() / MS_PER_DAY);
}

/**
 * Choose one featured title. Curated titles win over the fallback pool, and
 * titles with wide backdrop artwork win over ones without, so the banner gets a
 * strong composition whenever the catalog allows it. One pick per UTC day
 * rotates through the chosen pool; there is no autoplay carousel.
 */
export function pickFeatured(
  candidates: readonly MediaItem[],
  dayIndex: number,
  curatedSlugs: readonly string[] = FEATURED_SLUGS,
): FeaturedPick | null {
  const bySlug = new Map(candidates.map((item) => [item.slug, item]));
  const curated = curatedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((item): item is MediaItem => Boolean(item));

  const pools: Array<{ items: MediaItem[]; curated: boolean }> = [
    { items: curated.filter(hasBackdrop), curated: true },
    { items: curated, curated: true },
    { items: candidates.filter(hasBackdrop), curated: false },
    { items: [...candidates], curated: false },
  ];
  const pool = pools.find((p) => p.items.length > 0);
  if (!pool) return null;

  const index =
    ((Math.trunc(dayIndex) % pool.items.length) + pool.items.length) %
    pool.items.length;
  return { item: pool.items[index], curated: pool.curated };
}

function hasBackdrop(item: MediaItem): boolean {
  return typeof item.backdropUrl === "string" && item.backdropUrl.length > 0;
}
