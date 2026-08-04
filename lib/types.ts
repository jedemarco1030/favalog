/**
 * Core domain models for Favalog.
 *
 * These types are intentionally framework-agnostic so they can be reused
 * by the current mock data layer and by a future backend/API layer without
 * changes to the consuming UI code.
 */

export type MediaKind = "movie" | "tv" | "book";

/**
 * The shared shape every trackable title in Favalog conforms to.
 * Type-specific fields live on the discriminated variants below.
 */
export interface MediaItemBase {
  id: string;
  /**
   * Stable, URL-safe identifier used for `/title/[slug]` routes.
   * Distinct from `id` so that a display title change never breaks a URL.
   */
  slug: string;
  kind: MediaKind;
  title: string;
  /** Optional subtitle, e.g. a book's subtitle or a film's original title. */
  subtitle?: string;
  /** Short editorial blurb shown on cards and detail pages. */
  synopsis: string;
  /** ISO year of primary release / publication. */
  year: number;
  /** Poster / cover artwork URL. */
  posterUrl: string;
  /** Optional wide backdrop artwork URL used on hero surfaces. */
  backdropUrl?: string;
  /** Aggregate community rating on a 0–5 scale, if available. */
  averageRating?: number;
  /** Free-form genre tags. */
  genres: string[];
}

export interface Movie extends MediaItemBase {
  kind: "movie";
  runtimeMinutes: number;
  director: string;
  cast: string[];
}

export interface TVShow extends MediaItemBase {
  kind: "tv";
  seasons: number;
  episodes: number;
  creators: string[];
  status: "ongoing" | "ended" | "upcoming";
}

export interface Book extends MediaItemBase {
  kind: "book";
  authors: string[];
  pageCount: number;
  publisher?: string;
}

export type MediaItem = Movie | TVShow | Book;

export interface User {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  followerCount: number;
  followingCount: number;
}

/** A 0–5 rating in half-star increments. */
export type RatingValue = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface Rating {
  id: string;
  userId: string;
  mediaId: string;
  value: RatingValue;
  createdAt: string;
}

/**
 * Bucketed rating counts for a `MediaItem`, indexed by star bucket.
 * Buckets are the integer star values 1..5; half-star ratings are folded
 * into the nearest whole-star bucket for display in the histogram.
 */
export interface RatingDistribution {
  mediaId: string;
  /** Total number of ratings across all buckets. */
  count: number;
  /** Community average rating (0–5). */
  average: number;
  /** Count of ratings per whole-star bucket (index 0 -> 1★ … index 4 -> 5★). */
  buckets: [number, number, number, number, number];
}

export interface Review {
  id: string;
  userId: string;
  mediaId: string;
  rating?: RatingValue;
  title?: string;
  body: string;
  createdAt: string;
  likeCount: number;
  containsSpoilers: boolean;
}

/**
 * Reserved access model for a list. Unused by MVP rendering (every mock list
 * is treated as public) but carried on the type so the storage shape does not
 * have to change when real visibility rules and authentication arrive.
 */
export type ListVisibility = "public" | "unlisted" | "private";

/**
 * A user-authored, cross-media collection of titles.
 *
 * A list is intentionally media-agnostic: a single list can mix movies, TV,
 * and books. Titles are referenced by `mediaIds` (resolved against the
 * catalog) rather than embedded, so a list stays a thin record and can never
 * drift from the canonical `MediaItem`.
 */
export interface List {
  id: string;
  /**
   * Stable, URL-safe identifier used for `/list/[slug]` routes. Distinct from
   * `id` and from the display `title` so that renaming a list never breaks a
   * shared URL.
   */
  slug: string;
  ownerId: string;
  title: string;
  description?: string;
  /** Ordered media references. When `isRanked`, the order is a deliberate ranking. */
  mediaIds: string[];
  /**
   * Optional short curator note per title, keyed by media id. Only a subset of
   * items typically carry a note; the map is sparse on purpose.
   */
  notes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  /** When true, `mediaIds` order is a ranking that should be shown to users. */
  isRanked: boolean;
  /** Community like count. Presentation-only in the current MVP. */
  likeCount: number;
  /** Reserved future access model; unused by MVP rendering. */
  visibility?: ListVisibility;
}

export type ActivityKind =
  "rated" | "reviewed" | "listed" | "finished" | "started";

export interface ActivityItem {
  id: string;
  userId: string;
  mediaId: string;
  kind: ActivityKind;
  createdAt: string;
  /** Optional rating attached to the activity (for `rated` / `reviewed`). */
  rating?: RatingValue;
  /** Optional short excerpt, e.g. for a review activity card. */
  excerpt?: string;
}

/**
 * The verb describing what a user did when they logged a title in their diary.
 * The vocabulary is deliberately media-aware: films/series are watched, books
 * are read, and either can be revisited.
 */
export type DiaryAction = "watched" | "rewatched" | "read" | "reread";

/**
 * A single chronological entry in a user's unified entertainment diary — the
 * record of a title they watched or read on a given day.
 *
 * Media is referenced by `mediaId` (resolved against the catalog) rather than
 * embedded, and any attached review is referenced by `reviewId` rather than
 * duplicated, so a diary entry stays a thin log row.
 */
export interface DiaryEntry {
  id: string;
  userId: string;
  mediaId: string;
  /** ISO timestamp of when the title was logged (the diary date). */
  loggedAt: string;
  /** The verb for this entry; defaults are derived from the media kind. */
  action?: DiaryAction;
  /** The rating the user gave at log time, if they rated it. */
  rating?: RatingValue;
  /** Id of an associated `Review`, if the user wrote one. */
  reviewId?: string;
}
