import {
  OPEN_LIBRARY_BASE,
  openLibraryCoverUrl,
  workKeyToId,
} from "@/lib/catalog/openlibrary/config";
import {
  RAWG_BASE,
  rawgIdToExternalId,
  rawgImageUrl,
} from "@/lib/catalog/rawg/config";
import {
  TMDB_API_BASE,
  TMDB_BACKDROP_SIZE,
  TMDB_LANGUAGE,
  TMDB_POSTER_SIZE,
  tmdbImageUrl,
} from "@/lib/catalog/tmdb/config";
import type { ExternalProvider } from "@/lib/catalog/types";
import type { DiscoveryCandidate } from "./types";
import { parseReleaseDate, yearOf } from "./windows";

/**
 * Pure request builders and normalizers for related-title browsing.
 *
 * Every relationship comes from an explicit provider link on the source title
 * (a TMDB collection id, a RAWG developer id, an Open Library author key), never
 * from matching names or titles. Results are bounded to one page and always
 * exclude the source title itself.
 */

export const RELATED_LIMIT = 12;

export type RelationKind = "collection" | "developer" | "author";

export interface RelatedGroup {
  relation: RelationKind;
  provider: ExternalProvider;
  /** The related entity's provider display name, e.g. "Dune Collection". */
  name: string;
  candidates: DiscoveryCandidate[];
}

/** Heading copy that states exactly what links the titles. */
export function relatedHeading(group: Pick<RelatedGroup, "relation" | "name">) {
  switch (group.relation) {
    case "collection":
      return /^the\s/i.test(group.name)
        ? `In ${group.name}`
        : `In the ${group.name}`;
    case "developer":
      return `More games from ${group.name}`;
    case "author":
      return `More books by ${group.name}`;
  }
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function ranked(candidates: Omit<DiscoveryCandidate, "rank">[]) {
  return candidates
    .slice(0, RELATED_LIMIT)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

// --- TMDB movie collections ---------------------------------------------------

/** Stored TMDB external ids are `movie:<id>` / `tv:<id>`; the API wants the bare id. */
export function tmdbNumericId(externalId: string): string {
  const separator = externalId.indexOf(":");
  return separator === -1 ? externalId : externalId.slice(separator + 1);
}

export function tmdbMovieUrl(movieId: string): string {
  return `${TMDB_API_BASE}/movie/${encodeURIComponent(movieId)}?language=${TMDB_LANGUAGE}`;
}

export function tmdbCollectionUrl(collectionId: number): string {
  return `${TMDB_API_BASE}/collection/${collectionId}?language=${TMDB_LANGUAGE}`;
}

export function collectionFromTmdbMovie(
  json: unknown,
): { id: number; name: string } | null {
  const link = (json as { belongs_to_collection?: unknown } | null)
    ?.belongs_to_collection as { id?: unknown; name?: unknown } | null;
  const id = positiveInt(link?.id);
  const name = text(link?.name);
  return id && name ? { id, name } : null;
}

/** Collection parts in release order; undated parts follow dated ones. */
export function normalizeTmdbCollection(
  json: unknown,
  excludeId: string,
): DiscoveryCandidate[] {
  const parts = (json as { parts?: unknown } | null)?.parts;
  if (!Array.isArray(parts)) return [];

  const rows: Omit<DiscoveryCandidate, "rank">[] = [];
  for (const part of parts as Record<string, unknown>[]) {
    if (part?.adult === true) continue;
    const id = positiveInt(part?.id);
    const title = text(part?.title);
    if (!id || !title || String(id) === excludeId) continue;
    const releaseDate = parseReleaseDate(part.release_date);
    rows.push({
      ref: { provider: "tmdb", kind: "movie", externalId: String(id) },
      kind: "movie",
      title,
      year: yearOf(releaseDate),
      releaseDate,
      posterUrl: tmdbImageUrl(
        part.poster_path as string | null,
        TMDB_POSTER_SIZE,
      ),
      backdropUrl: tmdbImageUrl(
        part.backdrop_path as string | null,
        TMDB_BACKDROP_SIZE,
      ),
      overview: text(part.overview),
    });
  }

  rows.sort((a, b) => {
    if (a.releaseDate && b.releaseDate)
      return a.releaseDate.localeCompare(b.releaseDate);
    return a.releaseDate ? -1 : b.releaseDate ? 1 : 0;
  });
  return ranked(rows);
}

// --- RAWG developers ----------------------------------------------------------

export function rawgGameUrl(gameId: string, key: string): string {
  return `${RAWG_BASE}/games/${encodeURIComponent(gameId)}?key=${encodeURIComponent(key)}`;
}

export function rawgDeveloperGamesUrl(
  developerId: number,
  key: string,
): string {
  const params = new URLSearchParams({
    key,
    developers: String(developerId),
    ordering: "-added",
    page_size: String(RELATED_LIMIT + 1),
  });
  return `${RAWG_BASE}/games?${params.toString()}`;
}

/** The game's first listed developer, which RAWG treats as the lead studio. */
export function developerFromRawgGame(
  json: unknown,
): { id: number; name: string } | null {
  const developers = (json as { developers?: unknown } | null)?.developers;
  if (!Array.isArray(developers)) return null;
  const first = developers[0] as { id?: unknown; name?: unknown } | undefined;
  const id = positiveInt(first?.id);
  const name = text(first?.name);
  return id && name ? { id, name } : null;
}

/** Developer games in RAWG's popularity order (`-added`), minus the source. */
export function normalizeRawgDeveloperGames(
  json: unknown,
  excludeId: string,
): DiscoveryCandidate[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];

  const rows: Omit<DiscoveryCandidate, "rank">[] = [];
  for (const row of results as Record<string, unknown>[]) {
    const externalId = rawgIdToExternalId(row?.id);
    const title = text(row?.name);
    if (!externalId || !title || externalId === excludeId) continue;
    const releaseDate =
      row.tba === true ? undefined : parseReleaseDate(row.released);
    const art = rawgImageUrl(row.background_image);
    rows.push({
      ref: { provider: "rawg", kind: "game", externalId },
      kind: "game",
      title,
      year: yearOf(releaseDate),
      releaseDate,
      posterUrl: art,
      backdropUrl: art,
    });
  }
  return ranked(rows);
}

// --- Open Library authors -----------------------------------------------------

export function openLibraryWorkUrl(workId: string): string {
  return `${OPEN_LIBRARY_BASE}/works/${encodeURIComponent(workId)}.json`;
}

export function openLibraryAuthorUrl(authorId: string): string {
  return `${OPEN_LIBRARY_BASE}/authors/${encodeURIComponent(authorId)}.json`;
}

export function openLibraryAuthorWorksUrl(authorId: string): string {
  return `${OPEN_LIBRARY_BASE}/authors/${encodeURIComponent(authorId)}/works.json?limit=${RELATED_LIMIT * 2}`;
}

/** The Work's first credited author id (e.g. `OL23919A`). */
export function authorIdFromWork(json: unknown): string | null {
  const authors = (json as { authors?: unknown } | null)?.authors;
  if (!Array.isArray(authors)) return null;
  const key = (authors[0] as { author?: { key?: unknown } } | undefined)?.author
    ?.key;
  if (typeof key !== "string") return null;
  const match = /^\/authors\/(OL\d+A)$/.exec(key.trim());
  return match ? match[1] : null;
}

export function authorNameFromRecord(json: unknown): string | undefined {
  return text((json as { name?: unknown } | null)?.name);
}

/** The author's works as Open Library lists them, minus the source Work. */
export function normalizeOpenLibraryAuthorWorks(
  json: unknown,
  excludeId: string,
): DiscoveryCandidate[] {
  const entries = (json as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) return [];

  const seen = new Set<string>([excludeId]);
  const rows: Omit<DiscoveryCandidate, "rank">[] = [];
  for (const entry of entries as Record<string, unknown>[]) {
    const workId = workKeyToId(entry?.key as string | undefined);
    const title = text(entry?.title);
    if (!workId || !title || seen.has(workId)) continue;
    seen.add(workId);
    const covers = Array.isArray(entry.covers) ? entry.covers : [];
    rows.push({
      ref: { provider: "openlibrary", kind: "book", externalId: workId },
      kind: "book",
      title,
      posterUrl: openLibraryCoverUrl(covers[0] as number | undefined),
    });
  }
  return ranked(rows);
}
