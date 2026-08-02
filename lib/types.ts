/**
 * Core domain models for Lorely.
 *
 * These types are intentionally framework-agnostic so they can be reused
 * by the current mock data layer and by a future backend/API layer without
 * changes to the consuming UI code.
 */

export type MediaKind = "movie" | "tv" | "book";

/**
 * The shared shape every trackable title in Lorely conforms to.
 * Type-specific fields live on the discriminated variants below.
 */
export interface MediaItemBase {
  id: string;
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

export interface List {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  mediaIds: string[];
  createdAt: string;
  updatedAt: string;
  isRanked: boolean;
}

export type ActivityKind =
  | "rated"
  | "reviewed"
  | "listed"
  | "finished"
  | "started";

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
