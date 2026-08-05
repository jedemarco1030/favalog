import type { ActivityItem, MediaItem } from "@/lib/types";
import { getActivityForUser, getReviewsByUser } from "./activity";
import { getDiaryEntriesForUser, getDiaryEntryMedia } from "./diary";
import { getListsByUser } from "./lists";

/**
 * Aggregated, derived statistics for a user's profile.
 *
 * Every value is computed from existing mock data (diary, reviews, lists) so
 * the profile can never carry independently-hardcoded totals that drift from
 * the underlying records. Nothing here is stored on the `User`.
 */
export interface UserProfileStats {
  moviesWatched: number;
  showsWatched: number;
  booksRead: number;
  reviews: number;
  lists: number;
  /**
   * Mean of every rated diary entry, on the 0–5 scale, rounded to one decimal
   * place. `undefined` when the user has rated nothing.
   */
  averageRating?: number;
}

/**
 * Derive a user's profile statistics from their diary, reviews, and lists.
 *
 * "Watched / read" counts come from diary entries (resolved to media by id to
 * read the kind), the review and list totals from their respective selectors,
 * and the average rating from the ratings attached to diary entries.
 */
export function getUserProfileStats(userId: string): UserProfileStats {
  const entries = getDiaryEntriesForUser(userId);

  let moviesWatched = 0;
  let showsWatched = 0;
  let booksRead = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const entry of entries) {
    const kind = getDiaryEntryMedia(entry)?.kind;
    if (kind === "movie") moviesWatched += 1;
    else if (kind === "tv") showsWatched += 1;
    else if (kind === "book") booksRead += 1;

    if (entry.rating != null) {
      ratingSum += entry.rating;
      ratingCount += 1;
    }
  }

  const averageRating =
    ratingCount > 0
      ? Math.round((ratingSum / ratingCount) * 10) / 10
      : undefined;

  return {
    moviesWatched,
    showsWatched,
    booksRead,
    reviews: getReviewsByUser(userId).length,
    lists: getListsByUser(userId).length,
    averageRating,
  };
}

/**
 * Distinct titles a user recently watched (movies and TV), newest first.
 * Derived from the diary — deduplicated by media id so a rewatch does not show
 * the same title twice — so the profile never keeps a second copy of history.
 */
export function getUserRecentlyWatched(userId: string, limit = 6): MediaItem[] {
  return recentDiaryMedia(userId, (kind) => kind !== "book", limit);
}

/** Distinct books a user recently read, newest first. Derived from the diary. */
export function getUserRecentlyRead(userId: string, limit = 6): MediaItem[] {
  return recentDiaryMedia(userId, (kind) => kind === "book", limit);
}

/** A user's own recent activity feed, newest first, capped at `limit`. */
export function getUserRecentActivity(
  userId: string,
  limit = 6,
): ActivityItem[] {
  return getActivityForUser(userId).slice(0, limit);
}

/**
 * Shared helper: newest-first, de-duplicated media pulled from a user's diary
 * and narrowed by kind. `getDiaryEntriesForUser` already sorts newest first,
 * so first-seen order is the correct recency order.
 */
function recentDiaryMedia(
  userId: string,
  matches: (kind: MediaItem["kind"]) => boolean,
  limit: number,
): MediaItem[] {
  const seen = new Set<string>();
  const result: MediaItem[] = [];

  for (const entry of getDiaryEntriesForUser(userId)) {
    const media = getDiaryEntryMedia(entry);
    if (!media || !matches(media.kind) || seen.has(media.id)) continue;
    seen.add(media.id);
    result.push(media);
    if (result.length >= limit) break;
  }

  return result;
}
