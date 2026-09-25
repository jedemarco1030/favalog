/**
 * Server-only RAWG catalog provider (video games).
 *
 * Implements the provider-neutral {@link CatalogProvider} seam over RAWG's
 * `/games` search and `/games/{id}` detail endpoints. The API key is read from
 * the server-only `RAWG_API_KEY` only when an operation runs, and a missing key
 * FAILS CLOSED with `not_configured` before any request is issued. Non-game
 * kind filters return an empty page without touching the network.
 *
 * All network access goes through {@link fetchProviderJson} for uniform
 * timeouts, retries, and safe error mapping (which never echoes the URL, so the
 * key-bearing query string never reaches logs or errors).
 *
 * Server-only: never import from a client component.
 */

import {
  DETAIL_CACHE_TTL_SECONDS,
  MAX_SEARCH_RESULTS,
  SEARCH_CACHE_TTL_SECONDS,
} from "../config.ts";
import { CatalogProviderError, providerError } from "../errors.ts";
import { fetchProviderJson, type FetchLike } from "../http.ts";
import {
  consoleLogSink,
  logCatalogOperation,
  type CatalogLogSink,
} from "../log.ts";
import type { RetryEnvironment } from "../reliability";
import type {
  CatalogProvider,
  CatalogSearchCandidate,
  CatalogSearchOptions,
  ExternalRef,
  NormalizedMediaItem,
  ProviderPage,
} from "../types";
import { clampPage, normalizeQuery } from "../validation.ts";
import { getRawgApiKey, isRawgGameId, RAWG_BASE } from "./config.ts";
import { normalizeRawgGame, normalizeRawgSearchResult } from "./normalize.ts";
import type { RawgGameDetail, RawgSearchResponse } from "./types";

/** Injectable dependencies for the RAWG provider. */
export interface RawgProviderOptions {
  /** Overrides the server-only API key (tests pass a value). */
  apiKey?: string;
  /** Overrides the API base URL (only via the loopback test-transport seam). */
  baseUrl?: string;
  fetchImpl?: FetchLike;
  retryEnv?: RetryEnvironment;
  logSink?: CatalogLogSink;
}

const PROVIDER = "rawg" as const;

/** Create a RAWG {@link CatalogProvider}. */
export function createRawgProvider(
  options: RawgProviderOptions = {},
): CatalogProvider {
  const logSink = options.logSink ?? consoleLogSink;
  const apiBase = options.baseUrl ?? RAWG_BASE;

  function requireKey(operation: string): string {
    const key = options.apiKey ?? getRawgApiKey();
    if (!key) {
      throw providerError({
        provider: PROVIDER,
        operation,
        category: "not_configured",
      });
    }
    return key;
  }

  async function observed<T>(
    operation: string,
    run: () => Promise<{ value: T; retries: number }>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const { value, retries } = await run();
      logCatalogOperation(
        {
          provider: PROVIDER,
          operation,
          outcome: "ok",
          latencyMs: Date.now() - start,
          retries,
        },
        logSink,
      );
      return value;
    } catch (error) {
      logCatalogOperation(
        {
          provider: PROVIDER,
          operation,
          outcome: "error",
          latencyMs: Date.now() - start,
          retries: 0,
          errorCategory:
            error instanceof CatalogProviderError ? error.category : "unknown",
        },
        logSink,
      );
      throw error;
    }
  }

  return {
    id: PROVIDER,
    kinds: ["game"],

    async search(
      opts: CatalogSearchOptions,
    ): Promise<ProviderPage<CatalogSearchCandidate>> {
      const kind = opts.kind ?? "all";
      if (kind !== "all" && kind !== "game") {
        return { items: [], page: clampPage(opts.page), hasMore: false };
      }

      const validated = normalizeQuery(opts.query);
      if (!validated.ok) {
        throw providerError(
          { provider: PROVIDER, operation: "search", category: "validation" },
          `[rawg] search failed: ${validated.error}`,
        );
      }
      const page = clampPage(opts.page);
      const key = requireKey("search");

      const params = new URLSearchParams({
        key,
        search: validated.value,
        search_precise: "true",
        page: String(page),
        page_size: String(MAX_SEARCH_RESULTS),
      });
      const url = `${apiBase}/games?${params.toString()}`;

      return observed("search", async () => {
        const { data, retries } = await fetchProviderJson<RawgSearchResponse>({
          provider: PROVIDER,
          operation: "search",
          url,
          cacheTtlSeconds: SEARCH_CACHE_TTL_SECONDS,
          signal: opts.signal,
          fetchImpl: options.fetchImpl,
          retryEnv: options.retryEnv,
        });
        const items = (data.results ?? [])
          .map(normalizeRawgSearchResult)
          .filter((c): c is CatalogSearchCandidate => c !== null)
          .slice(0, MAX_SEARCH_RESULTS);
        const value: ProviderPage<CatalogSearchCandidate> = {
          items,
          page,
          hasMore: typeof data.next === "string" && data.next.length > 0,
        };
        return { value, retries };
      });
    },

    async getByExternalId(
      ref: ExternalRef,
      signal?: AbortSignal,
    ): Promise<NormalizedMediaItem> {
      if (
        ref.provider !== PROVIDER ||
        ref.kind !== "game" ||
        !isRawgGameId(ref.externalId)
      ) {
        throw providerError({
          provider: PROVIDER,
          operation: "getByExternalId",
          category: "validation",
        });
      }
      const key = requireKey("getByExternalId");
      const params = new URLSearchParams({ key });
      const url = `${apiBase}/games/${ref.externalId}?${params.toString()}`;

      return observed("getByExternalId", async () => {
        const { data, retries } = await fetchProviderJson<RawgGameDetail>({
          provider: PROVIDER,
          operation: "getByExternalId",
          url,
          cacheTtlSeconds: DETAIL_CACHE_TTL_SECONDS,
          signal,
          fetchImpl: options.fetchImpl,
          retryEnv: options.retryEnv,
        });
        const item = normalizeRawgGame(data);
        // The trusted record must describe the id we asked for.
        if (item.ref.externalId !== ref.externalId) {
          throw providerError({
            provider: PROVIDER,
            operation: "getByExternalId",
            category: "not_found",
          });
        }
        return { value: item, retries };
      });
    },
  };
}
