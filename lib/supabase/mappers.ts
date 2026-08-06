/**
 * Domain mapping boundary: database rows -> Favalog domain models.
 *
 * This is a small, deliberately-scoped proof of concept. It does NOT replace
 * the mock-data selectors and it does NOT build a full repository layer. Its
 * purpose is to (a) validate that the `media_items` schema maps cleanly onto
 * the `MediaItem` discriminated union in `lib/types.ts`, and (b) establish the
 * pattern for the eventual persistence layer: generated DB row types stay on
 * one side, framework-agnostic domain types on the other, and mappers bridge
 * them — the UI never sees a raw database row.
 *
 * Kind-specific fields live in the row's `details` JSONB payload; the mappers
 * below narrow on `kind` and read the fields each variant requires, keeping the
 * strict TypeScript domain model intact.
 */

import type { Database, Json } from "@/lib/database.types";
import type {
  Book,
  DiaryEntry,
  MediaItem,
  Movie,
  Profile,
  RatingValue,
  Review,
  TVShow,
} from "@/lib/types";
import { deriveDiaryAction } from "./log-input";

export type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type DiaryEntryRow =
  Database["public"]["Tables"]["diary_entries"]["Row"];
export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

/**
 * Map a `profiles` row to the {@link Profile} domain identity.
 *
 * Nullable database columns collapse to `undefined` so the domain type stays
 * clean (optional rather than nullable), matching how the rest of the domain
 * model expresses "absent". Derived statistics are deliberately NOT part of a
 * profile — they come from diary/reviews/lists elsewhere.
 */
export function mapProfileRowToDomain(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio ?? undefined,
    location: row.location ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Narrow an unknown JSONB payload to a plain object for safe field access. */
function asRecord(details: Json): Record<string, Json | undefined> {
  return details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, Json | undefined>)
    : {};
}

function readString(value: Json | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: Json | undefined, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function readStringArray(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Fields shared by every media kind, mapped from normal columns. */
function mapBaseFields(row: MediaItemRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    synopsis: row.synopsis,
    year: row.year,
    posterUrl: row.poster_url ?? "",
    backdropUrl: row.backdrop_url ?? undefined,
    averageRating: row.average_rating ?? undefined,
    genres: row.genres,
  };
}

/**
 * Map a single `media_items` row to the `MediaItem` domain union.
 *
 * Throws on an unknown `kind` so a malformed row surfaces loudly rather than
 * silently producing an invalid domain object.
 */
export function mapMediaRowToDomain(row: MediaItemRow): MediaItem {
  const base = mapBaseFields(row);
  const details = asRecord(row.details);

  switch (row.kind) {
    case "movie": {
      const movie: Movie = {
        ...base,
        kind: "movie",
        runtimeMinutes: readNumber(details.runtimeMinutes),
        director: readString(details.director),
        cast: readStringArray(details.cast),
      };
      return movie;
    }
    case "tv": {
      const rawStatus = readString(details.status, "ongoing");
      const status: TVShow["status"] =
        rawStatus === "ended" || rawStatus === "upcoming"
          ? rawStatus
          : "ongoing";
      const show: TVShow = {
        ...base,
        kind: "tv",
        seasons: readNumber(details.seasons),
        episodes: readNumber(details.episodes),
        creators: readStringArray(details.creators),
        status,
      };
      return show;
    }
    case "book": {
      const book: Book = {
        ...base,
        kind: "book",
        authors: readStringArray(details.authors),
        pageCount: readNumber(details.pageCount),
        publisher: details.publisher
          ? readString(details.publisher)
          : undefined,
      };
      return book;
    }
    default: {
      // Exhaustiveness guard: `kind` is a bounded enum, but a row from a future
      // migration could carry an unmapped value.
      const exhaustiveKind: never = row.kind;
      throw new Error(`Unknown media kind: ${String(exhaustiveKind)}`);
    }
  }
}

/** Map many rows, preserving order. */
export function mapMediaRowsToDomain(rows: MediaItemRow[]): MediaItem[] {
  return rows.map(mapMediaRowToDomain);
}

/**
 * Coerce a nullable DB `numeric(2,1)` rating into a domain {@link RatingValue}.
 *
 * Returns `undefined` for a null/out-of-range value so the domain stays clean
 * (optional rather than nullable). The DB CHECK already guarantees half-star
 * values, but this stays defensive against a malformed row.
 */
export function toRatingValue(
  value: number | null | undefined,
): RatingValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (value < 0.5 || value > 5 || value * 2 !== Math.floor(value * 2)) {
    return undefined;
  }
  return value as RatingValue;
}

/**
 * Map a `reviews` row to the {@link Review} domain type. `likeCount` is not a
 * persisted column in this phase, so it maps to 0 (likes are out of scope).
 */
export function mapReviewRowToDomain(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    rating: toRatingValue(row.rating),
    title: row.title ?? undefined,
    body: row.body,
    createdAt: row.created_at,
    likeCount: 0,
    containsSpoilers: row.contains_spoilers,
  };
}

/**
 * Map a `diary_entries` row to the {@link DiaryEntry} domain type.
 *
 * The media-aware `action` verb is derived from the referenced title's `kind`
 * plus the row's `is_revisit` flag (watched/rewatched for movies & TV,
 * read/reread for books) rather than stored on the row. Pass the resolved
 * media (already fetched alongside the entry to avoid an N+1) and, when the
 * entry has a linked review, its id.
 */
export function mapDiaryRowToDomain(
  row: DiaryEntryRow,
  media: Pick<MediaItem, "kind">,
  reviewId?: string,
): DiaryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    loggedAt: row.logged_at,
    action: deriveDiaryAction(media.kind, row.is_revisit),
    rating: toRatingValue(row.rating),
    reviewId,
  };
}
