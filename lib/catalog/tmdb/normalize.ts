/**
 * Pure TMDB → provider-neutral normalization.
 *
 * These functions translate the minimal TMDB wire shapes into Favalog's
 * bounded, normalized types. They are pure (no I/O, no secrets) and defensive:
 * every field is optional on the wire, so each is coerced through the shared
 * bounded helpers and missing data degrades gracefully (empty string / empty
 * list / omitted). No unbounded text or array is ever produced.
 */

import {
  MAX_CAST,
  MAX_CREATORS,
  MAX_SUBTITLE_LENGTH,
  MAX_SYNOPSIS_LENGTH,
  MAX_TITLE_LENGTH,
} from "../config.ts";
import {
  capGenres,
  capList,
  capText,
  coercePositiveInt,
  coerceRating,
  coerceYear,
} from "../normalize-helpers.ts";
import type { CatalogSearchCandidate, NormalizedMediaItem } from "../types";
import {
  TMDB_BACKDROP_SIZE,
  TMDB_POSTER_SIZE,
  TMDB_RATING_SCALE,
  tmdbImageUrl,
} from "./config.ts";
import type {
  TmdbGenre,
  TmdbMovieDetail,
  TmdbSearchMovieResult,
  TmdbSearchTvResult,
  TmdbTvDetail,
} from "./types";

/** Extract genre names from TMDB's `[{id, name}]`. */
function genreNames(genres: TmdbGenre[] | undefined): string[] {
  if (!Array.isArray(genres)) return [];
  return capGenres(genres.map((g) => g?.name));
}

/** Derive an optional subtitle only when the original title genuinely differs. */
function optionalSubtitle(
  title: string,
  original: unknown,
): string | undefined {
  const cleaned = capText(original, MAX_SUBTITLE_LENGTH);
  if (!cleaned) return undefined;
  if (cleaned.toLowerCase() === title.toLowerCase()) return undefined;
  return cleaned;
}

/**
 * Map TMDB's free-form series `status` onto the Favalog TV status enum.
 * "Ended"/"Canceled" → ended; upcoming states → upcoming; everything else
 * (including "Returning Series") → ongoing.
 */
export function mapTmdbTvStatus(
  status: string | undefined,
): "ongoing" | "ended" | "upcoming" {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "ended" || value === "canceled" || value === "cancelled") {
    return "ended";
  }
  if (value === "in production" || value === "planned" || value === "pilot") {
    return "upcoming";
  }
  return "ongoing";
}

/** Normalize a TMDB movie detail record into a {@link NormalizedMediaItem}. */
export function normalizeTmdbMovie(
  detail: TmdbMovieDetail,
): NormalizedMediaItem {
  const title = capText(
    detail.title ?? detail.original_title,
    MAX_TITLE_LENGTH,
  );
  const director = capText(
    detail.credits?.crew?.find((c) => (c?.job ?? "") === "Director")?.name,
    MAX_TITLE_LENGTH,
  );
  const cast = capList(
    [...(detail.credits?.cast ?? [])]
      .sort((a, b) => (a?.order ?? 999) - (b?.order ?? 999))
      .map((c) => c?.name),
    MAX_CAST,
  );

  return {
    ref: {
      provider: "tmdb",
      kind: "movie",
      externalId: String(detail.id ?? ""),
    },
    kind: "movie",
    title,
    subtitle: optionalSubtitle(title, detail.original_title),
    synopsis: capText(detail.overview, MAX_SYNOPSIS_LENGTH),
    year: coerceYear(detail.release_date) ?? 0,
    genres: genreNames(detail.genres),
    posterUrl: tmdbImageUrl(detail.poster_path, TMDB_POSTER_SIZE),
    backdropUrl: tmdbImageUrl(detail.backdrop_path, TMDB_BACKDROP_SIZE),
    averageRating: coerceRating(detail.vote_average, TMDB_RATING_SCALE),
    runtimeMinutes: coercePositiveInt(detail.runtime),
    director,
    cast,
  };
}

/** Normalize a TMDB TV detail record into a {@link NormalizedMediaItem}. */
export function normalizeTmdbTv(detail: TmdbTvDetail): NormalizedMediaItem {
  const title = capText(detail.name ?? detail.original_name, MAX_TITLE_LENGTH);
  const creators = capList(
    (detail.created_by ?? []).map((c) => c?.name),
    MAX_CREATORS,
  );

  return {
    ref: { provider: "tmdb", kind: "tv", externalId: String(detail.id ?? "") },
    kind: "tv",
    title,
    subtitle: optionalSubtitle(title, detail.original_name),
    synopsis: capText(detail.overview, MAX_SYNOPSIS_LENGTH),
    year: coerceYear(detail.first_air_date) ?? 0,
    genres: genreNames(detail.genres),
    posterUrl: tmdbImageUrl(detail.poster_path, TMDB_POSTER_SIZE),
    backdropUrl: tmdbImageUrl(detail.backdrop_path, TMDB_BACKDROP_SIZE),
    averageRating: coerceRating(detail.vote_average, TMDB_RATING_SCALE),
    seasons: coercePositiveInt(detail.number_of_seasons),
    episodes: coercePositiveInt(detail.number_of_episodes),
    creators,
    status: mapTmdbTvStatus(detail.status),
  };
}

/**
 * Normalize a TMDB movie search hit into a candidate, or `null` when it lacks a
 * usable id/title (so a junk row never becomes a candidate).
 */
export function normalizeTmdbMovieCandidate(
  result: TmdbSearchMovieResult,
): CatalogSearchCandidate | null {
  const id = result.id;
  const title = capText(
    result.title ?? result.original_title,
    MAX_TITLE_LENGTH,
  );
  if (typeof id !== "number" || !title) return null;
  return {
    ref: { provider: "tmdb", kind: "movie", externalId: String(id) },
    kind: "movie",
    title,
    year: coerceYear(result.release_date),
    subtitle: optionalSubtitle(title, result.original_title),
    posterUrl: tmdbImageUrl(result.poster_path, TMDB_POSTER_SIZE),
  };
}

/** Normalize a TMDB TV search hit into a candidate, or `null` when unusable. */
export function normalizeTmdbTvCandidate(
  result: TmdbSearchTvResult,
): CatalogSearchCandidate | null {
  const id = result.id;
  const title = capText(result.name ?? result.original_name, MAX_TITLE_LENGTH);
  if (typeof id !== "number" || !title) return null;
  return {
    ref: { provider: "tmdb", kind: "tv", externalId: String(id) },
    kind: "tv",
    title,
    year: coerceYear(result.first_air_date),
    subtitle: optionalSubtitle(title, result.original_name),
    posterUrl: tmdbImageUrl(result.poster_path, TMDB_POSTER_SIZE),
  };
}
