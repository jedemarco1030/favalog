/**
 * Server-only Open Library catalog provider (books).
 *
 * Implements the provider-neutral {@link CatalogProvider} seam using Open
 * Library's Search + Work + Author JSON APIs. It sends an identifying
 * `User-Agent` (built from the server-only `OPEN_LIBRARY_CONTACT_EMAIL`) and
 * FAILS CLOSED with a `not_configured` error when the contact is missing, so we
 * never issue an anonymous request. Requests ask for only the fields we need,
 * results are cached, and volume is intentionally low (single-item imports and
 * on-demand search) — no crawling or bulk ingestion.
 *
 * All network access goes through {@link fetchProviderJson} for uniform
 * timeouts, retries, `Retry-After`, and safe error mapping. The `fetch`,
 * contact, retry environment, and log sink are injectable so tests run offline.
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
import { capText, coerceYear } from "../normalize-helpers.ts";
import { MAX_PERSON_NAME_LENGTH } from "../config.ts";
import { clampPage, normalizeQuery } from "../validation.ts";
import {
  buildUserAgent,
  getOpenLibraryContact,
  OPEN_LIBRARY_BASE,
  workIdToKey,
} from "./config.ts";
import {
  authorKeysFromWork,
  normalizeOpenLibrarySearchDoc,
  normalizeOpenLibraryWork,
} from "./normalize.ts";
import type {
  OpenLibraryAuthor,
  OpenLibrarySearchResponse,
  OpenLibraryWork,
} from "./types";

/** Injectable dependencies for the Open Library provider. */
export interface OpenLibraryProviderOptions {
  /** Overrides the server-only contact (tests pass a value). */
  contact?: string;
  /**
   * Overrides the API base URL. Production leaves this unset (the real Open
   * Library host); the server registry only supplies a value via the test-only,
   * loopback-guarded transport seam (see `lib/catalog/test-transport.ts`).
   */
  baseUrl?: string;
  fetchImpl?: FetchLike;
  retryEnv?: RetryEnvironment;
  logSink?: CatalogLogSink;
}

const PROVIDER = "openlibrary" as const;

/** Only the Search API fields we actually use are requested. */
const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,subject";

/**
 * Fields for the bounded Work-key year fallback. Only the identifying key (to
 * prove the row is the one we asked for) and the publish year are requested.
 */
const WORK_YEAR_FALLBACK_FIELDS = "key,first_publish_year";

/**
 * Resolve a TRUSTED publish year from an exact Work-key Search response, or
 * `undefined` when it is not safe to trust. It is accepted ONLY when the
 * response carries exactly one result, that result's `key` exactly equals the
 * requested `/works/<WORK_ID>` key, and its `first_publish_year` passes the
 * shared year bounds ({@link coerceYear}). Anything else — empty, multiple,
 * mismatched key, or missing/implausible year — yields `undefined` so the
 * caller continues to fail safely. Pure (no I/O); never reads client input.
 */
export function fallbackYearFromWorkKeySearch(
  response: OpenLibrarySearchResponse,
  expectedKey: string,
): number | undefined {
  const docs = response.docs ?? [];
  if (docs.length !== 1) return undefined;
  const doc = docs[0];
  if (typeof doc.key !== "string" || doc.key.trim() !== expectedKey) {
    return undefined;
  }
  return coerceYear(doc.first_publish_year);
}

/** Create an Open Library {@link CatalogProvider}. */
export function createOpenLibraryProvider(
  options: OpenLibraryProviderOptions = {},
): CatalogProvider {
  const logSink = options.logSink ?? consoleLogSink;
  const apiBase = options.baseUrl ?? OPEN_LIBRARY_BASE;

  function requireContact(operation: string): string {
    const contact = options.contact ?? getOpenLibraryContact();
    if (!contact) {
      throw providerError({
        provider: PROVIDER,
        operation,
        category: "not_configured",
      });
    }
    return contact;
  }

  function headers(contact: string): Record<string, string> {
    return { "User-Agent": buildUserAgent(contact) };
  }

  async function fetchOL<T>(
    operation: string,
    url: string,
    contact: string,
    cacheTtlSeconds: number,
    signal?: AbortSignal,
  ): Promise<{ data: T; retries: number }> {
    return fetchProviderJson<T>({
      provider: PROVIDER,
      operation,
      url,
      headers: headers(contact),
      cacheTtlSeconds,
      signal,
      fetchImpl: options.fetchImpl,
      retryEnv: options.retryEnv,
    });
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

  return {
    id: PROVIDER,
    kinds: ["book"],

    async search(
      opts: CatalogSearchOptions,
    ): Promise<ProviderPage<CatalogSearchCandidate>> {
      // Open Library only serves books; a movie/tv-only filter yields nothing.
      const kind = opts.kind ?? "all";
      if (kind === "movie" || kind === "tv") {
        return { items: [], page: clampPage(opts.page), hasMore: false };
      }

      const validated = normalizeQuery(opts.query);
      if (!validated.ok) {
        throw providerError(
          { provider: PROVIDER, operation: "search", category: "validation" },
          `[openlibrary] search failed: ${validated.error}`,
        );
      }
      const page = clampPage(opts.page);
      const contact = requireContact("search");

      const params = new URLSearchParams({
        q: validated.value,
        fields: SEARCH_FIELDS,
        limit: String(MAX_SEARCH_RESULTS),
        page: String(page),
      });
      const url = `${apiBase}/search.json?${params.toString()}`;

      return observed("search", async () => {
        const { data, retries } = await fetchOL<OpenLibrarySearchResponse>(
          "search",
          url,
          contact,
          SEARCH_CACHE_TTL_SECONDS,
          opts.signal,
        );
        const items = (data.docs ?? [])
          .map(normalizeOpenLibrarySearchDoc)
          .filter((c): c is CatalogSearchCandidate => c !== null)
          .slice(0, MAX_SEARCH_RESULTS);
        const numFound = data.numFound ?? items.length;
        const value: ProviderPage<CatalogSearchCandidate> = {
          items,
          page,
          hasMore: page * MAX_SEARCH_RESULTS < numFound,
        };
        return { value, retries };
      });
    },

    async getByExternalId(
      ref: ExternalRef,
      signal?: AbortSignal,
    ): Promise<NormalizedMediaItem> {
      if (ref.provider !== PROVIDER || ref.kind !== "book") {
        throw providerError({
          provider: PROVIDER,
          operation: "getByExternalId",
          category: "validation",
        });
      }
      const contact = requireContact("getByExternalId");
      const workKey = workIdToKey(ref.externalId);
      const workUrl = `${apiBase}${workKey}.json`;

      return observed("getByExternalId", async () => {
        const { data: work, retries: workRetries } =
          await fetchOL<OpenLibraryWork>(
            "getByExternalId",
            workUrl,
            contact,
            DETAIL_CACHE_TTL_SECONDS,
            signal,
          );
        let totalRetries = workRetries;

        // The trusted Work record is authoritative for the year when it carries
        // a plausible `first_publish_date`. Some real Works (e.g. Dune,
        // OL893414W) omit it even though the Search API knows the year, which
        // would otherwise fail materialization. In that case ONLY — and never
        // by trusting client-supplied search-card metadata — make one bounded
        // exact Work-key Search lookup for the year.
        let fallbackYear: number | undefined;
        if (coerceYear(work.first_publish_date) === undefined) {
          const params = new URLSearchParams({
            q: `key:"${workKey}"`,
            fields: WORK_YEAR_FALLBACK_FIELDS,
            limit: "1",
          });
          const fallbackUrl = `${apiBase}/search.json?${params.toString()}`;
          const { data: fallback, retries: fallbackRetries } =
            await fetchOL<OpenLibrarySearchResponse>(
              "getByExternalId",
              fallbackUrl,
              contact,
              SEARCH_CACHE_TTL_SECONDS,
              signal,
            );
          totalRetries += fallbackRetries;
          fallbackYear = fallbackYearFromWorkKeySearch(fallback, workKey);
        }

        // Resolve author names (bounded). A failed author lookup must not fail
        // the whole import — a missing author name degrades to omission.
        const authorKeys = authorKeysFromWork(work);
        const authorNames: string[] = [];
        for (const key of authorKeys) {
          try {
            const { data: author, retries } = await fetchOL<OpenLibraryAuthor>(
              "getByExternalId",
              `${apiBase}${key}.json`,
              contact,
              DETAIL_CACHE_TTL_SECONDS,
              signal,
            );
            totalRetries += retries;
            const name = capText(author.name, MAX_PERSON_NAME_LENGTH);
            if (name) authorNames.push(name);
          } catch (error) {
            // A hard auth/timeout/unavailable on an author lookup is still fatal
            // (we cannot trust a partial record under those conditions); only a
            // not_found author is tolerated as an omission.
            if (
              error instanceof CatalogProviderError &&
              error.category === "not_found"
            ) {
              continue;
            }
            throw error;
          }
        }

        return {
          value: normalizeOpenLibraryWork(work, authorNames, fallbackYear),
          retries: totalRetries,
        };
      });
    },
  };
}
