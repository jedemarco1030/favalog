import {
  TMDB_LANGUAGE,
  TMDB_API_BASE,
  TMDB_BACKDROP_SIZE,
  TMDB_POSTER_SIZE,
  tmdbImageUrl,
} from "@/lib/catalog/tmdb/config";
import {
  RAWG_BASE,
  rawgIdToExternalId,
  rawgImageUrl,
} from "@/lib/catalog/rawg/config";
import {
  OPEN_LIBRARY_BASE,
  openLibraryCoverUrl,
  workKeyToId,
} from "@/lib/catalog/openlibrary/config";
import type { DiscoveryCandidate } from "./types";
import { TMDB_TOP_RATED_MIN_VOTES, type ShelfDefinition } from "./shelves";
import {
  isWithin,
  isoDay,
  parseReleaseDate,
  recentWindow,
  upcomingWindow,
  yearOf,
  type DateWindow,
} from "./windows";

/**
 * Pure request builders and response normalizers for discovery shelves. Every
 * ordering is requested from the provider (server-side sort), so page N of a
 * shelf is page N of the provider's own result set. Normalizers only drop rows
 * that break a shelf's declared rules (missing identity, unconfirmed or
 * out-of-window dates); they never reorder.
 */

export interface ShelfFetchResult {
  candidates: DiscoveryCandidate[];
  hasMore: boolean;
}

function dateWindowFor(def: ShelfDefinition, now: Date): DateWindow | null {
  if (def.sort === "recent") return recentWindow(now);
  if (def.sort === "upcoming") return upcomingWindow(now);
  return null;
}

function rankOf(def: ShelfDefinition, page: number, index: number): number {
  return (page - 1) * def.pageSize + index + 1;
}

function dedupe(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.ref.kind}:${c.ref.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

// --- TMDB --------------------------------------------------------------------

export function tmdbShelfUrl(
  def: ShelfDefinition,
  page: number,
  now: Date,
  base: string = TMDB_API_BASE,
): string {
  const kind = def.kind === "tv" ? "tv" : "movie";
  const params = new URLSearchParams({
    language: TMDB_LANGUAGE,
    page: String(page),
  });

  if (def.sort === "trending") {
    return `${base}/trending/${kind}/week?${params}`;
  }

  params.set("include_adult", "false");
  const dateField = kind === "tv" ? "first_air_date" : "primary_release_date";
  const window = dateWindowFor(def, now);
  if (window) {
    params.set(`${dateField}.gte`, window.from);
    params.set(`${dateField}.lte`, window.to);
  }
  if (def.sort === "top-rated") {
    params.set("sort_by", "vote_average.desc");
    params.set("vote_count.gte", String(TMDB_TOP_RATED_MIN_VOTES[kind]));
  } else {
    params.set("sort_by", "popularity.desc");
  }
  return `${base}/discover/${kind}?${params}`;
}

interface TmdbListItem {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  poster_path?: unknown;
  backdrop_path?: unknown;
  overview?: unknown;
  adult?: unknown;
}

interface TmdbListResponse {
  page?: unknown;
  total_pages?: unknown;
  results?: unknown;
}

export function normalizeTmdbShelf(
  json: unknown,
  def: ShelfDefinition,
  page: number,
  now: Date,
): ShelfFetchResult {
  const body = (json ?? {}) as TmdbListResponse;
  const rows = Array.isArray(body.results)
    ? (body.results as TmdbListItem[])
    : [];
  const window = dateWindowFor(def, now);
  const candidates: DiscoveryCandidate[] = [];

  rows.forEach((row, index) => {
    if (row.adult === true) return;
    if (typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0)
      return;
    const title = text(def.kind === "tv" ? row.name : row.title);
    if (!title) return;
    const releaseDate = parseReleaseDate(
      def.kind === "tv" ? row.first_air_date : row.release_date,
    );
    if (window && (!releaseDate || !isWithin(releaseDate, window))) return;

    candidates.push({
      ref: { provider: "tmdb", kind: def.kind, externalId: String(row.id) },
      kind: def.kind,
      title,
      year: yearOf(releaseDate),
      releaseDate,
      posterUrl: tmdbImageUrl(
        row.poster_path as string | null,
        TMDB_POSTER_SIZE,
      ),
      backdropUrl: tmdbImageUrl(
        row.backdrop_path as string | null,
        TMDB_BACKDROP_SIZE,
      ),
      overview: text(row.overview),
      rank: rankOf(def, page, index),
    });
  });

  const totalPages =
    typeof body.total_pages === "number" ? body.total_pages : page;
  return {
    candidates: dedupe(candidates),
    hasMore: page < Math.min(totalPages, def.maxPages),
  };
}

// --- RAWG --------------------------------------------------------------------

export function rawgShelfUrl(
  def: ShelfDefinition,
  page: number,
  now: Date,
  apiKey: string,
  base: string = RAWG_BASE,
): string {
  const params = new URLSearchParams({
    key: apiKey,
    page: String(page),
    page_size: String(def.pageSize),
  });
  const window = dateWindowFor(def, now);
  if (window) params.set("dates", `${window.from},${window.to}`);
  if (def.sort === "top-rated") {
    params.set("ordering", "-metacritic");
    params.set("metacritic", "1,100");
  } else {
    params.set("ordering", "-added");
  }
  return `${base}/games?${params}`;
}

interface RawgListItem {
  id?: unknown;
  name?: unknown;
  released?: unknown;
  tba?: unknown;
  background_image?: unknown;
}

export function normalizeRawgShelf(
  json: unknown,
  def: ShelfDefinition,
  page: number,
  now: Date,
): ShelfFetchResult {
  const body = (json ?? {}) as { results?: unknown; next?: unknown };
  const rows = Array.isArray(body.results)
    ? (body.results as RawgListItem[])
    : [];
  const window = dateWindowFor(def, now);
  const candidates: DiscoveryCandidate[] = [];

  rows.forEach((row, index) => {
    const externalId = rawgIdToExternalId(row.id);
    const title = text(row.name);
    if (!externalId || !title) return;
    // RAWG marks placeholder dates with `tba`; they are never a confirmed date.
    const releaseDate =
      row.tba === true ? undefined : parseReleaseDate(row.released);
    if (window && (!releaseDate || !isWithin(releaseDate, window))) return;
    const art = rawgImageUrl(row.background_image);

    candidates.push({
      ref: { provider: "rawg", kind: "game", externalId },
      kind: "game",
      title,
      year: yearOf(releaseDate),
      releaseDate,
      posterUrl: art,
      backdropUrl: art,
      rank: rankOf(def, page, index),
    });
  });

  return {
    candidates: dedupe(candidates),
    hasMore: Boolean(body.next) && page < def.maxPages,
  };
}

// --- Open Library ------------------------------------------------------------

/** One request per freshness window covers every page of the book shelf. */
export function openLibraryTrendingUrl(
  def: ShelfDefinition,
  base: string = OPEN_LIBRARY_BASE,
): string {
  return `${base}/trending/weekly.json?limit=${def.pageSize * def.maxPages}`;
}

interface OpenLibraryTrendingWork {
  key?: unknown;
  title?: unknown;
  cover_i?: unknown;
  first_publish_year?: unknown;
}

/** Normalize the whole trending list in provider order. */
export function normalizeOpenLibraryTrending(
  json: unknown,
): DiscoveryCandidate[] {
  const body = (json ?? {}) as { works?: unknown };
  const rows = Array.isArray(body.works)
    ? (body.works as OpenLibraryTrendingWork[])
    : [];
  const candidates: DiscoveryCandidate[] = [];
  rows.forEach((row, index) => {
    const externalId = workKeyToId(row.key as string | undefined);
    const title = text(row.title);
    if (!externalId || !title) return;
    const year =
      typeof row.first_publish_year === "number" && row.first_publish_year > 0
        ? row.first_publish_year
        : undefined;
    candidates.push({
      ref: { provider: "openlibrary", kind: "book", externalId },
      kind: "book",
      title,
      year,
      posterUrl: openLibraryCoverUrl(row.cover_i as number | undefined),
      rank: index + 1,
    });
  });
  return dedupe(candidates);
}

export function pageOf(
  all: DiscoveryCandidate[],
  def: ShelfDefinition,
  page: number,
): ShelfFetchResult {
  const start = (page - 1) * def.pageSize;
  return {
    candidates: all.slice(start, start + def.pageSize),
    hasMore: start + def.pageSize < all.length && page < def.maxPages,
  };
}

/** Cache key date bucket: date windows move once per UTC day. */
export function dayBucket(now: Date): string {
  return isoDay(now);
}
