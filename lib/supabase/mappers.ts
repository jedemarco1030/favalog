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
import type { Book, MediaItem, Movie, TVShow } from "@/lib/types";

export type MediaItemRow = Database["public"]["Tables"]["media_items"]["Row"];

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
