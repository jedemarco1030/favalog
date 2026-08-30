/**
 * TMDB adapter configuration (server-only).
 *
 * The TMDB API read token is a SECRET read only here, on the server, from
 * `TMDB_API_READ_TOKEN`. It is used as an HTTP bearer credential and is NEVER
 * exposed to the browser (no `NEXT_PUBLIC_`), never logged, never serialized,
 * and never returned to a caller. Nothing in this module throws at import time,
 * so a build with no TMDB token still succeeds; a live call without a token
 * fails closed with a `not_configured` provider error.
 *
 * ATTRIBUTION: TMDB requires attribution ("This product uses the TMDB API but
 * is not endorsed or certified by TMDB.") and the approved TMDB logo wherever
 * TMDB data is shown to users. This phase performs NO user-facing rendering; the
 * attribution + logo MUST be added before any TMDB result is surfaced in the UI
 * (see ADR 0004).
 */

import { DEFAULT_LANGUAGE } from "../config.ts";

/** TMDB REST v3 base. */
export const TMDB_API_BASE = "https://api.themoviedb.org/3" as const;

/**
 * Approved image host + sizes. Stored image references are always built from a
 * TMDB-controlled path against THIS host — an arbitrary URL is never accepted or
 * stored.
 */
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p" as const;
export const TMDB_POSTER_SIZE = "w500" as const;
export const TMDB_BACKDROP_SIZE = "w1280" as const;

/** TMDB rates vote_average on a 0–10 scale; we rescale to Favalog's 0–5. */
export const TMDB_RATING_SCALE = 10 as const;

/** Explicit, documented request language. Consistent English metadata. */
export const TMDB_LANGUAGE = DEFAULT_LANGUAGE;

/**
 * Read the server-only TMDB read token. Returns `undefined` (never throws) when
 * unset/blank so callers can fail closed with a `not_configured` error rather
 * than crash a build or page.
 */
export function getTmdbToken(): string | undefined {
  const token = process.env.TMDB_API_READ_TOKEN?.trim();
  return token ? token : undefined;
}

/** Whether a usable TMDB token is configured. Returns only a boolean. */
export function isTmdbConfigured(): boolean {
  return getTmdbToken() !== undefined;
}

/**
 * Build a safe absolute image URL from a TMDB image path, or `undefined` when
 * the path is missing/blank. Only a leading-slash TMDB path is accepted; any
 * other value (including an absolute URL) is rejected so a poisoned path can
 * never redirect our stored image to an arbitrary host.
 */
export function tmdbImageUrl(
  path: string | null | undefined,
  size: string,
): string | undefined {
  if (typeof path !== "string") return undefined;
  const trimmed = path.trim();
  if (!/^\/[A-Za-z0-9._-]+$/.test(trimmed)) return undefined;
  return `${TMDB_IMAGE_BASE}/${size}${trimmed}`;
}
