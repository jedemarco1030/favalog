/**
 * Minimal RAWG wire types. Only fields the adapter reads are described, all
 * optional — nothing is assumed present. These stay INTERNAL to the adapter.
 */

export interface RawgNamed {
  name?: string;
}

export interface RawgPlatformEntry {
  platform?: RawgNamed;
}

/** A `/games` search result (subset). */
export interface RawgGameSummary {
  id?: number;
  slug?: string;
  name?: string;
  released?: string | null;
  tba?: boolean;
  background_image?: string | null;
  rating?: number;
  genres?: RawgNamed[];
  platforms?: RawgPlatformEntry[] | null;
}

/** The `/games` envelope. */
export interface RawgSearchResponse {
  count?: number;
  next?: string | null;
  results?: RawgGameSummary[];
}

/** A `/games/{id}` record (subset). */
export interface RawgGameDetail extends RawgGameSummary {
  name_original?: string;
  description_raw?: string;
  background_image_additional?: string | null;
  developers?: RawgNamed[];
  publishers?: RawgNamed[];
}
