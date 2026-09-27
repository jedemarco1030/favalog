import "server-only";

import { unstable_cache } from "next/cache";
import { CatalogProviderError, providerError } from "@/lib/catalog/errors";
import { isExternalProviderAvailable } from "@/lib/catalog/feature-flag";
import { fetchProviderJson, type FetchLike } from "@/lib/catalog/http";
import {
  buildUserAgent,
  getOpenLibraryContact,
} from "@/lib/catalog/openlibrary/config";
import { getRawgApiKey } from "@/lib/catalog/rawg/config";
import { getTmdbToken } from "@/lib/catalog/tmdb/config";
import type { ExternalProvider } from "@/lib/catalog/types";
import {
  dayBucket,
  normalizeOpenLibraryTrending,
  normalizeRawgShelf,
  normalizeTmdbShelf,
  openLibraryTrendingUrl,
  pageOf,
  rawgShelfUrl,
  tmdbShelfUrl,
  type ShelfFetchResult,
} from "./providers";
import { DISCOVERY_SHELVES, type ShelfDefinition } from "./shelves";
import type {
  DiscoveryCandidate,
  DiscoveryResult,
  DiscoveryShelfId,
} from "./types";

/**
 * Shared, cached discovery reads for Home and Explore.
 *
 * Each (shelf, page, UTC day) is cached in Next's shared data cache for the
 * shelf's freshness window and refreshed stale-while-revalidate, so requests
 * are served from cache and a background refresh that fails keeps the last
 * good page. A cold cache is filled by one live provider call bounded by the
 * catalog request timeout. Failures are never cached and never replaced with
 * demo data: the shelf reports `unavailable` and the page decides what to show.
 *
 * This is separate from `catalog-refresh`, which refreshes metadata for titles
 * already saved in Favalog. Discovery never writes to the database.
 */

/** Discovery shelves share this cache tag, e.g. for `revalidateTag("discovery")`. */
export const DISCOVERY_CACHE_TAG = "discovery";

export type CacheWrapper = <T>(
  fn: () => Promise<T>,
  key: string[],
  revalidateSeconds: number,
) => Promise<T>;

export const nextDataCache: CacheWrapper = (fn, key, revalidateSeconds) =>
  unstable_cache(fn, key, {
    revalidate: revalidateSeconds,
    tags: [DISCOVERY_CACHE_TAG],
  })();

export interface DiscoveryDeps {
  now?: () => Date;
  cache?: CacheWrapper;
  fetchImpl?: FetchLike;
  isAvailable?: (provider: ExternalProvider) => boolean;
  credentials?: {
    tmdbToken?: string;
    rawgKey?: string;
    openLibraryContact?: string;
  };
}

interface CachedShelf extends ShelfFetchResult {
  fetchedAt: string;
}

function notConfigured(provider: ExternalProvider, operation: string): never {
  throw providerError({ provider, operation, category: "not_configured" });
}

async function fetchShelf(
  def: ShelfDefinition,
  page: number,
  now: Date,
  deps: DiscoveryDeps,
): Promise<ShelfFetchResult> {
  const operation = `discovery:${def.id}`;
  const fetchImpl = deps.fetchImpl;

  if (def.provider === "tmdb") {
    const token = deps.credentials?.tmdbToken ?? getTmdbToken();
    if (!token) notConfigured("tmdb", operation);
    const { data } = await fetchProviderJson<unknown>({
      provider: "tmdb",
      operation,
      url: tmdbShelfUrl(def, page, now),
      headers: { Authorization: `Bearer ${token}` },
      fetchImpl,
    });
    return normalizeTmdbShelf(data, def, page, now);
  }

  if (def.provider === "rawg") {
    const key = deps.credentials?.rawgKey ?? getRawgApiKey();
    if (!key) notConfigured("rawg", operation);
    const { data } = await fetchProviderJson<unknown>({
      provider: "rawg",
      operation,
      url: rawgShelfUrl(def, page, now, key),
      fetchImpl,
    });
    return normalizeRawgShelf(data, def, page, now);
  }

  throw new Error(`Unsupported discovery provider: ${def.provider}`);
}

async function fetchOpenLibraryAll(
  def: ShelfDefinition,
  deps: DiscoveryDeps,
): Promise<DiscoveryCandidate[]> {
  const contact =
    deps.credentials?.openLibraryContact ?? getOpenLibraryContact();
  if (!contact) notConfigured("openlibrary", `discovery:${def.id}`);
  const { data } = await fetchProviderJson<unknown>({
    provider: "openlibrary",
    operation: `discovery:${def.id}`,
    url: openLibraryTrendingUrl(def),
    headers: { "User-Agent": buildUserAgent(contact) },
    fetchImpl: deps.fetchImpl,
  });
  return normalizeOpenLibraryTrending(data);
}

export async function getDiscoveryShelf(
  shelfId: DiscoveryShelfId,
  requestedPage = 1,
  deps: DiscoveryDeps = {},
): Promise<DiscoveryResult> {
  const def = DISCOVERY_SHELVES[shelfId];
  const isAvailable = deps.isAvailable ?? isExternalProviderAvailable;
  if (!isAvailable(def.provider)) {
    return { status: "unavailable", shelfId, reason: "disabled" };
  }

  const page = Math.min(
    Math.max(1, Math.trunc(requestedPage) || 1),
    def.maxPages,
  );
  const now = (deps.now ?? (() => new Date()))();
  const cache = deps.cache ?? nextDataCache;
  const day = dayBucket(now);

  try {
    let result: CachedShelf;
    if (def.provider === "openlibrary") {
      const all = await cache(
        async () => ({
          candidates: await fetchOpenLibraryAll(def, deps),
          fetchedAt: new Date().toISOString(),
        }),
        ["discovery", def.id, day],
        def.freshnessSeconds,
      );
      result = {
        ...pageOf(all.candidates, def, page),
        fetchedAt: all.fetchedAt,
      };
    } else {
      result = await cache(
        async () => ({
          ...(await fetchShelf(def, page, now, deps)),
          fetchedAt: new Date().toISOString(),
        }),
        ["discovery", def.id, String(page), day],
        def.freshnessSeconds,
      );
    }

    return {
      status: "ok",
      page: {
        shelfId,
        provider: def.provider,
        kind: def.kind,
        ranking: def.ranking,
        page,
        hasMore: result.hasMore,
        fetchedAt: result.fetchedAt,
        candidates: result.candidates,
      },
    };
  } catch (error) {
    const category =
      error instanceof CatalogProviderError ? error.category : "unknown";
    console.warn(
      JSON.stringify({
        event: "discovery.shelf_unavailable",
        shelfId,
        page,
        category,
      }),
    );
    return {
      status: "unavailable",
      shelfId,
      reason: "provider-error",
      category,
    };
  }
}
