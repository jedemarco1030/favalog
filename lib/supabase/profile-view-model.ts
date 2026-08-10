/**
 * Pure derivation helpers for the real (Supabase-backed) public profile.
 *
 * Deliberately free of any server/Supabase imports so the statistics logic can
 * be unit-tested in isolation and reused wherever a set of resolved diary
 * entries / reviews is available. The server read layer (`profile-activity.ts`)
 * fetches and maps rows; these functions turn the mapped, serializable data
 * into the numbers and lists the profile renders. Derived statistics live here,
 * never on the stored {@link import("@/lib/types").Profile} identity.
 */

import type { MediaItem, MediaKind } from "@/lib/types";

/** A resolved diary entry, reduced to what profile statistics need. */
export interface ProfileDiaryEntry {
  mediaId: string;
  kind: MediaKind;
  /** Rating recorded on the diary entry (the rating source of truth). */
  rating: number | null;
  /** The fully resolved title, reused for the "recently …" rails. */
  media: MediaItem;
}

/** The derived, serializable statistics shown on a real profile. */
export interface ProfileStatsView {
  /** Distinct movie titles logged. */
  moviesWatched: number;
  /** Distinct TV titles logged. */
  tvWatched: number;
  /** Distinct book titles logged. */
  booksRead: number;
  /** Total reviews written. */
  reviews: number;
  /** Mean of all rated diary entries, or `null` when nothing is rated. */
  averageRating: number | null;
}

/**
 * Derive profile statistics from resolved diary entries plus a review count.
 *
 * Counts are of DISTINCT titles per kind (a rewatch/reread does not inflate the
 * "watched"/"read" totals), and the average rating is computed only over
 * entries that actually carry a rating.
 */
export function deriveProfileStats(
  entries: readonly ProfileDiaryEntry[],
  reviewCount: number,
): ProfileStatsView {
  const distinct: Record<MediaKind, Set<string>> = {
    movie: new Set(),
    tv: new Set(),
    book: new Set(),
  };
  let ratingSum = 0;
  let ratingCount = 0;

  for (const entry of entries) {
    distinct[entry.kind].add(entry.mediaId);
    if (entry.rating != null) {
      ratingSum += entry.rating;
      ratingCount += 1;
    }
  }

  return {
    moviesWatched: distinct.movie.size,
    tvWatched: distinct.tv.size,
    booksRead: distinct.book.size,
    reviews: reviewCount,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
  };
}

/**
 * Resolve the rating to DISPLAY for a review.
 *
 * A diary-linked review stores `rating = null` by design — the linked diary
 * entry owns the rating — so its effective rating is the diary entry's. A
 * standalone review (no linked entry) uses its own rating. `undefined` means
 * genuinely unrated and the UI should show no stars.
 */
export function effectiveReviewRating(
  reviewRating: number | null | undefined,
  diaryRating: number | null | undefined,
): number | undefined {
  if (diaryRating != null) return diaryRating;
  if (reviewRating != null) return reviewRating;
  return undefined;
}

/**
 * The most recent DISTINCT titles matching any of `kinds`, preserving the
 * (already newest-first) order of `entries` and capped at `limit`.
 */
export function recentTitlesOfKinds(
  entries: readonly ProfileDiaryEntry[],
  kinds: readonly MediaKind[],
  limit: number,
): MediaItem[] {
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!kinds.includes(entry.kind)) continue;
    if (seen.has(entry.mediaId)) continue;
    seen.add(entry.mediaId);
    out.push(entry.media);
    if (out.length >= limit) break;
  }
  return out;
}
