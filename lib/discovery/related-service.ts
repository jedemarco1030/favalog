import "server-only";

import { CatalogProviderError } from "@/lib/catalog/errors";
import { isExternalProviderAvailable } from "@/lib/catalog/feature-flag";
import { fetchProviderJson } from "@/lib/catalog/http";
import {
  buildUserAgent,
  getOpenLibraryContact,
} from "@/lib/catalog/openlibrary/config";
import { getRawgApiKey } from "@/lib/catalog/rawg/config";
import { getTmdbToken } from "@/lib/catalog/tmdb/config";
import type { ExternalRef } from "@/lib/catalog/types";
import {
  authorIdFromWork,
  authorNameFromRecord,
  collectionFromTmdbMovie,
  tmdbNumericId,
  developerFromRawgGame,
  normalizeOpenLibraryAuthorWorks,
  normalizeRawgDeveloperGames,
  normalizeTmdbCollection,
  openLibraryAuthorUrl,
  openLibraryAuthorWorksUrl,
  openLibraryWorkUrl,
  rawgDeveloperGamesUrl,
  rawgGameUrl,
  tmdbCollectionUrl,
  tmdbMovieUrl,
  type RelatedGroup,
} from "./related";
import { logDiscoveryEvent } from "./log";
import { nextDataCache, type DiscoveryDeps } from "./service";

/**
 * Related titles for a saved title with a verified provider identity. Reads are
 * cached per source title for a day. Discovery never writes to the database:
 * related candidates open and save through the same trusted materializer as
 * every other discovery card.
 */
const RELATED_FRESHNESS_SECONDS = 60 * 60 * 24;

async function fetchRelated(
  ref: ExternalRef,
  deps: DiscoveryDeps,
): Promise<RelatedGroup | null> {
  const fetchImpl = deps.fetchImpl;

  if (ref.provider === "tmdb" && ref.kind === "movie") {
    const token = deps.credentials?.tmdbToken ?? getTmdbToken();
    if (!token) return null;
    const headers = { Authorization: `Bearer ${token}` };
    const { data: movie } = await fetchProviderJson<unknown>({
      provider: "tmdb",
      operation: "related:movie",
      url: tmdbMovieUrl(tmdbNumericId(ref.externalId)),
      headers,
      fetchImpl,
    });
    const collection = collectionFromTmdbMovie(movie);
    if (!collection) return null;
    const { data } = await fetchProviderJson<unknown>({
      provider: "tmdb",
      operation: "related:collection",
      url: tmdbCollectionUrl(collection.id),
      headers,
      fetchImpl,
    });
    return {
      relation: "collection",
      provider: "tmdb",
      name: collection.name,
      candidates: normalizeTmdbCollection(data, tmdbNumericId(ref.externalId)),
    };
  }

  if (ref.provider === "rawg") {
    const key = deps.credentials?.rawgKey ?? getRawgApiKey();
    if (!key) return null;
    const { data: game } = await fetchProviderJson<unknown>({
      provider: "rawg",
      operation: "related:game",
      url: rawgGameUrl(ref.externalId, key),
      fetchImpl,
    });
    const developer = developerFromRawgGame(game);
    if (!developer) return null;
    const { data } = await fetchProviderJson<unknown>({
      provider: "rawg",
      operation: "related:developer",
      url: rawgDeveloperGamesUrl(developer.id, key),
      fetchImpl,
    });
    return {
      relation: "developer",
      provider: "rawg",
      name: developer.name,
      candidates: normalizeRawgDeveloperGames(data, ref.externalId),
    };
  }

  if (ref.provider === "openlibrary") {
    const contact =
      deps.credentials?.openLibraryContact ?? getOpenLibraryContact();
    if (!contact) return null;
    const headers = { "User-Agent": buildUserAgent(contact) };
    const { data: work } = await fetchProviderJson<unknown>({
      provider: "openlibrary",
      operation: "related:work",
      url: openLibraryWorkUrl(ref.externalId),
      headers,
      fetchImpl,
    });
    const authorId = authorIdFromWork(work);
    if (!authorId) return null;
    const [{ data: author }, { data: works }] = await Promise.all([
      fetchProviderJson<unknown>({
        provider: "openlibrary",
        operation: "related:author",
        url: openLibraryAuthorUrl(authorId),
        headers,
        fetchImpl,
      }),
      fetchProviderJson<unknown>({
        provider: "openlibrary",
        operation: "related:author-works",
        url: openLibraryAuthorWorksUrl(authorId),
        headers,
        fetchImpl,
      }),
    ]);
    const name = authorNameFromRecord(author);
    if (!name) return null;
    return {
      relation: "author",
      provider: "openlibrary",
      name,
      candidates: normalizeOpenLibraryAuthorWorks(works, ref.externalId),
    };
  }

  return null;
}

/** Returns `null` when there is no relationship, no results, or any failure. */
export async function getRelatedTitles(
  ref: ExternalRef,
  deps: DiscoveryDeps = {},
): Promise<RelatedGroup | null> {
  const isAvailable = deps.isAvailable ?? isExternalProviderAvailable;
  if (!isAvailable(ref.provider)) return null;
  const cache = deps.cache ?? nextDataCache;
  const startedAt = performance.now();

  try {
    const group = await cache(
      () => fetchRelated(ref, deps),
      ["related", ref.provider, ref.kind, ref.externalId],
      RELATED_FRESHNESS_SECONDS,
    );
    return group && group.candidates.length > 0 ? group : null;
  } catch (error) {
    logDiscoveryEvent({
      event: "discovery.related_unavailable",
      provider: ref.provider,
      category:
        error instanceof CatalogProviderError ? error.category : "unknown",
      latencyMs: performance.now() - startedAt,
    });
    return null;
  }
}
