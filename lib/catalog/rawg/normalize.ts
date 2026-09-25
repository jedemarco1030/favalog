/**
 * Pure RAWG → provider-neutral normalization. Defensive: missing images,
 * release dates, studios, or platforms degrade gracefully; all text and lists
 * are bounded. A game with no usable release year normalizes to `year: 0`,
 * which the materialization boundary rejects rather than inventing a date.
 */

import {
  MAX_PLATFORMS,
  MAX_STUDIOS,
  MAX_SUBTITLE_LENGTH,
  MAX_SYNOPSIS_LENGTH,
  MAX_TITLE_LENGTH,
} from "../config.ts";
import {
  capGenres,
  capList,
  capText,
  coerceRating,
  coerceYear,
} from "../normalize-helpers.ts";
import type { CatalogSearchCandidate, NormalizedMediaItem } from "../types";
import { rawgIdToExternalId, rawgImageUrl } from "./config.ts";
import type {
  RawgGameDetail,
  RawgGameSummary,
  RawgNamed,
  RawgPlatformEntry,
} from "./types";

function names(value: RawgNamed[] | null | undefined): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => entry?.name);
}

function platformNames(
  value: RawgPlatformEntry[] | null | undefined,
): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => entry?.platform?.name);
}

/** A TBA game carries no trustworthy release year. */
function releaseYear(game: RawgGameSummary): number | undefined {
  if (game.tba === true) return undefined;
  return coerceYear(game.released ?? undefined);
}

/** Normalize a trusted `/games/{id}` record into a {@link NormalizedMediaItem}. */
export function normalizeRawgGame(game: RawgGameDetail): NormalizedMediaItem {
  const title = capText(game.name, MAX_TITLE_LENGTH);
  const original = capText(game.name_original, MAX_SUBTITLE_LENGTH);
  const cover = rawgImageUrl(game.background_image);

  return {
    ref: {
      provider: "rawg",
      kind: "game",
      externalId: rawgIdToExternalId(game.id) ?? "",
    },
    kind: "game",
    title,
    subtitle:
      original && original.toLowerCase() !== title.toLowerCase()
        ? original
        : undefined,
    synopsis: capText(game.description_raw, MAX_SYNOPSIS_LENGTH),
    year: releaseYear(game) ?? 0,
    // RAWG genres are a small, curated, closed set (Action, RPG, Indie, …), so
    // they are safe to persist after bounding — unlike free-form tags.
    genres: capGenres(names(game.genres)),
    posterUrl: cover,
    backdropUrl: rawgImageUrl(game.background_image_additional) ?? cover,
    averageRating: coerceRating(game.rating, 5),
    platforms: capList(platformNames(game.platforms), MAX_PLATFORMS),
    developers: capList(names(game.developers), MAX_STUDIOS),
    publishers: capList(names(game.publishers), MAX_STUDIOS),
  };
}

/** Normalize a `/games` search hit, or `null` when it lacks an id or title. */
export function normalizeRawgSearchResult(
  game: RawgGameSummary,
): CatalogSearchCandidate | null {
  const externalId = rawgIdToExternalId(game.id);
  const title = capText(game.name, MAX_TITLE_LENGTH);
  if (!externalId || !title) return null;
  return {
    ref: { provider: "rawg", kind: "game", externalId },
    kind: "game",
    title,
    year: releaseYear(game),
    posterUrl: rawgImageUrl(game.background_image),
  };
}
