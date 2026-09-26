import type { MediaItem } from "@/lib/types";

/**
 * Recent / upcoming release selection for Home.
 *
 * Favalog stores a release YEAR only (`media_items.year`) for every provider —
 * no month or day survives normalization — so this module is deliberately
 * year-precise and never claims more than the data supports:
 *
 *   - Window: the current calendar year and the {@link RECENT_RELEASE_PAST_YEARS}
 *     full years before it count as "recent"; any later year is "upcoming".
 *   - A title dated the CURRENT year is labelled "this year", not "released",
 *     because a year-only date cannot say whether it is out yet.
 *   - A missing / zero / non-integer year is "unknown" and never shown.
 *   - Import time (`created_at`) plays no part: a newly imported 1965 novel is
 *     not a new release.
 *
 * The year is the provider's primary date (TMDB primary release / first air
 * date, Open Library first publish year, RAWG release date). It is not
 * region-specific, and a series' year is its first season.
 */

/** Full calendar years before the current one that still count as recent. */
export const RECENT_RELEASE_PAST_YEARS = 2;

/** How many titles the Home release shelf shows at most. */
export const RELEASE_SHELF_LIMIT = 10;

export type ReleaseStatus =
  "upcoming" | "this-year" | "released" | "older" | "unknown";

export function classifyRelease(
  year: number,
  currentYear: number,
): ReleaseStatus {
  if (!Number.isInteger(year) || year <= 0) return "unknown";
  if (year > currentYear) return "upcoming";
  if (year === currentYear) return "this-year";
  if (year >= currentYear - RECENT_RELEASE_PAST_YEARS) return "released";
  return "older";
}

/** Earliest year the release shelf reads, so the query stays bounded. */
export function releaseWindowStartYear(currentYear: number): number {
  return currentYear - RECENT_RELEASE_PAST_YEARS;
}

/** Short, honest per-card label for a title's release status. */
export function releaseLabel(year: number, currentYear: number): string | null {
  switch (classifyRelease(year, currentYear)) {
    case "upcoming":
      return `Upcoming · ${year}`;
    case "this-year":
      return `${year} · This year`;
    case "released":
      return `Released ${year}`;
    default:
      return null;
  }
}

export interface ReleaseShelf {
  /** Titles dated the current year or the recent past, newest year first. */
  recent: MediaItem[];
  /** Titles dated a future year, soonest first. */
  upcoming: MediaItem[];
}

/**
 * Split candidates into the recent and upcoming groups. Within one year the
 * input order is kept (stable sort), so callers decide tie-breaks. Older and
 * undated titles are dropped.
 */
export function selectReleaseShelf(
  items: readonly MediaItem[],
  currentYear: number,
  limit: number = RELEASE_SHELF_LIMIT,
): ReleaseShelf {
  const recent: MediaItem[] = [];
  const upcoming: MediaItem[] = [];
  for (const item of items) {
    const status = classifyRelease(item.year, currentYear);
    if (status === "upcoming") upcoming.push(item);
    else if (status === "this-year" || status === "released") recent.push(item);
  }
  recent.sort((a, b) => b.year - a.year);
  upcoming.sort((a, b) => a.year - b.year);
  const upcomingShown = upcoming.slice(0, limit);
  return {
    upcoming: upcomingShown,
    recent: recent.slice(0, Math.max(0, limit - upcomingShown.length)),
  };
}
