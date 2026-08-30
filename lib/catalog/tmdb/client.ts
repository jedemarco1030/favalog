/**
 * Server-only TMDB catalog provider.
 *
 * Implements the provider-neutral {@link CatalogProvider} seam for movies + TV
 * using TMDB's REST v3 API with BEARER authentication. The read token is a
 * server-only secret (see {@link getTmdbToken}); it is never exposed, logged, or
 * returned. People results are excluded (movie/tv endpoints only), adult content
 * is disabled, and an explicit English locale is requested for consistency.
 *
 * All network access goes through {@link fetchProviderJson}, so timeouts,
 * retries, `Retry-After`, and safe error mapping are uniform. Every operation
 * emits ONE redaction-safe structured log line. The `fetch`, token, retry
 * environment, and log sink are injectable so tests run fully offline.
 *
 * This module must only be imported by server code (Server Actions, Route
 * Handlers, server-only services, the operator CLI) — never a client component.
 */

import {
  DETAIL_CACHE_TTL_SECONDS,
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
import { getTmdbToken, TMDB_API_BASE, TMDB_LANGUAGE } from "./config.ts";
import {
  normalizeTmdbMovie,
  normalizeTmdbMovieCandidate,
  normalizeTmdbTv,
  normalizeTmdbTvCandidate,
} from "./normalize.ts";
import type {
  TmdbMovieDetail,
  TmdbSearchMovieResult,
  TmdbSearchResponse,
  TmdbSearchTvResult,
  TmdbTvDetail,
} from "./types";

/** Injectable dependencies for the TMDB provider (all optional in production). */
export interface TmdbProviderOptions {
  /** Overrides the server-only token (tests pass a fake). */
  token?: string;
  /** Injected fetch (defaults to global `fetch`). */
  fetchImpl?: FetchLike;
  /** Injected retry environment (defaults to real timers). */
  retryEnv?: RetryEnvironment;
  /** Injected log sink (defaults to a single stdout JSON line). */
  logSink?: CatalogLogSink;
}

const PROVIDER = "tmdb" as const;

/** Create a TMDB {@link CatalogProvider}. */
export function createTmdbProvider(
  options: TmdbProviderOptions = {},
): CatalogProvider {
  const logSink = options.logSink ?? consoleLogSink;

  function requireToken(operation: string): string {
    const token = options.token ?? getTmdbToken();
    if (!token) {
      throw providerError({
        provider: PROVIDER,
        operation,
        category: "not_configured",
      });
    }
    return token;
  }

  function authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  async function fetchTmdb<T>(
    operation: string,
    url: string,
    token: string,
    cacheTtlSeconds: number,
    signal?: AbortSignal,
  ): Promise<{ data: T; retries: number }> {
    return fetchProviderJson<T>({
      provider: PROVIDER,
      operation,
      url,
      headers: authHeaders(token),
      cacheTtlSeconds,
      signal,
      fetchImpl: options.fetchImpl,
      retryEnv: options.retryEnv,
    });
  }

  /** Time + log a unit of work; rethrows the original error after logging. */
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
      const category =
        error instanceof CatalogProviderError ? error.category : "unknown";
      logCatalogOperation(
        {
          provider: PROVIDER,
          operation,
          outcome: "error",
          latencyMs: Date.now() - start,
          retries: 0,
          errorCategory: category,
        },
        logSink,
      );
      throw error;
    }
  }

  function searchUrl(
    kind: "movie" | "tv",
    query: string,
    page: number,
  ): string {
    const params = new URLSearchParams({
      query,
      include_adult: "false",
      language: TMDB_LANGUAGE,
      page: String(page),
    });
    return `${TMDB_API_BASE}/search/${kind}?${params.toString()}`;
  }

  async function searchOneKind(
    kind: "movie" | "tv",
    query: string,
    page: number,
    token: string,
    signal: AbortSignal | undefined,
  ): Promise<{ page: ProviderPage<CatalogSearchCandidate>; retries: number }> {
    if (kind === "movie") {
      const { data, retries } = await fetchTmdb<
        TmdbSearchResponse<TmdbSearchMovieResult>
      >(
        "search",
        searchUrl("movie", query, page),
        token,
        SEARCH_CACHE_TTL_SECONDS,
        signal,
      );
      const items = (data.results ?? [])
        .map(normalizeTmdbMovieCandidate)
        .filter((c): c is CatalogSearchCandidate => c !== null);
      return { page: toPage(items, data, page), retries };
    }
    const { data, retries } = await fetchTmdb<
      TmdbSearchResponse<TmdbSearchTvResult>
    >(
      "search",
      searchUrl("tv", query, page),
      token,
      SEARCH_CACHE_TTL_SECONDS,
      signal,
    );
    const items = (data.results ?? [])
      .map(normalizeTmdbTvCandidate)
      .filter((c): c is CatalogSearchCandidate => c !== null);
    return { page: toPage(items, data, page), retries };
  }

  function toPage(
    items: CatalogSearchCandidate[],
    data: TmdbSearchResponse<unknown>,
    page: number,
  ): ProviderPage<CatalogSearchCandidate> {
    const totalPages = data.total_pages;
    return {
      items,
      page,
      totalPages,
      hasMore: typeof totalPages === "number" ? page < totalPages : false,
    };
  }

  return {
    id: PROVIDER,
    kinds: ["movie", "tv"],

    async search(
      opts: CatalogSearchOptions,
    ): Promise<ProviderPage<CatalogSearchCandidate>> {
      const validated = normalizeQuery(opts.query);
      if (!validated.ok) {
        throw providerError(
          { provider: PROVIDER, operation: "search", category: "validation" },
          `[tmdb] search failed: ${validated.error}`,
        );
      }
      const query = validated.value;
      const page = clampPage(opts.page);
      const kind = opts.kind ?? "all";
      const token = requireToken("search");

      return observed("search", async () => {
        if (kind === "movie" || kind === "tv") {
          const { page: result, retries } = await searchOneKind(
            kind,
            query,
            page,
            token,
            opts.signal,
          );
          return { value: result, retries };
        }
        // `all` (or a kind TMDB doesn't serve as a single call) → movie + tv.
        const [movies, tv] = await Promise.all([
          searchOneKind("movie", query, page, token, opts.signal),
          searchOneKind("tv", query, page, token, opts.signal),
        ]);
        const items = interleave(movies.page.items, tv.page.items).slice(
          0,
          // MAX_SEARCH_RESULTS is applied by the caller/registry; keep both arms.
          movies.page.items.length + tv.page.items.length,
        );
        const value: ProviderPage<CatalogSearchCandidate> = {
          items,
          page,
          totalPages:
            Math.max(movies.page.totalPages ?? 0, tv.page.totalPages ?? 0) ||
            undefined,
          hasMore: movies.page.hasMore || tv.page.hasMore,
        };
        return { value, retries: movies.retries + tv.retries };
      });
    },

    async getByExternalId(
      ref: ExternalRef,
      signal?: AbortSignal,
    ): Promise<NormalizedMediaItem> {
      if (ref.provider !== PROVIDER) {
        throw providerError({
          provider: PROVIDER,
          operation: "getByExternalId",
          category: "validation",
        });
      }
      if (ref.kind === "book") {
        throw providerError({
          provider: PROVIDER,
          operation: "getByExternalId",
          category: "validation",
        });
      }
      const token = requireToken("getByExternalId");
      const path = ref.kind === "movie" ? "movie" : "tv";
      const params = new URLSearchParams({
        language: TMDB_LANGUAGE,
        append_to_response: "credits",
      });
      const url = `${TMDB_API_BASE}/${path}/${encodeURIComponent(ref.externalId)}?${params.toString()}`;

      return observed("getByExternalId", async () => {
        if (ref.kind === "movie") {
          const { data, retries } = await fetchTmdb<TmdbMovieDetail>(
            "getByExternalId",
            url,
            token,
            DETAIL_CACHE_TTL_SECONDS,
            signal,
          );
          return { value: normalizeTmdbMovie(data), retries };
        }
        const { data, retries } = await fetchTmdb<TmdbTvDetail>(
          "getByExternalId",
          url,
          token,
          DETAIL_CACHE_TTL_SECONDS,
          signal,
        );
        return { value: normalizeTmdbTv(data), retries };
      });
    },
  };
}

/** Interleave two candidate lists (movie, tv, movie, tv, …), preserving order. */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}
