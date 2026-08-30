/**
 * Minimal TMDB wire types.
 *
 * These describe ONLY the fields the adapter reads, as `unknown`-friendly
 * optionals — TMDB may add/rename fields and we must never assume presence.
 * These types stay INTERNAL to the TMDB adapter; the rest of the app depends on
 * the provider-neutral normalized types instead.
 */

export interface TmdbSearchMovieResult {
  id?: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
}

export interface TmdbSearchTvResult {
  id?: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  poster_path?: string | null;
}

export interface TmdbSearchResponse<T> {
  page?: number;
  results?: T[];
  total_pages?: number;
  total_results?: number;
}

export interface TmdbGenre {
  id?: number;
  name?: string;
}

export interface TmdbCredits {
  cast?: Array<{ name?: string; order?: number }>;
  crew?: Array<{ name?: string; job?: string; department?: string }>;
}

export interface TmdbMovieDetail {
  id?: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  runtime?: number;
  genres?: TmdbGenre[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  credits?: TmdbCredits;
}

export interface TmdbTvDetail {
  id?: number;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: TmdbGenre[];
  created_by?: Array<{ name?: string }>;
  status?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  credits?: TmdbCredits;
}
