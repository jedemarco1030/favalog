import "server-only";

/**
 * Server-only catalog BROWSE service (Explore, no active search query).
 *
 * This is the real, production-backed replacement for deriving Explore's
 * no-query view from the mock `@/lib/data` catalog. When Supabase is configured
 * it reads `public.media_items` directly through the per-request SSR client
 * (the table is public-read under RLS, so it works for signed-out visitors) and
 * returns a deterministic, globally-sorted, paginated slice of the real
 * catalog.
 *
 * Contracts that make this safe and truthful:
 *
 *   - Every input is server-validated and allow-listed via the pure parsers in
 *     `@/lib/browse/query` — no client-supplied SQL, column names, ordering
 *     directions, or page sizes are ever accepted.
 *   - Ordering is deterministic and ends in a unique `id` tie-breaker so
 *     pagination never drops or duplicates a row.
 *   - Pagination is bounded and the requested page is clamped to the real page
 *     count once the total is known.
 *   - A requested genre is reconciled against the REAL stored catalog genres
 *     and dropped safely when incompatible with the current media type.
 *   - It NEVER falls back to mock data: an unconfigured environment reports
 *     `unavailable` (the caller keeps the labelled example shelves) and a read
 *     failure reports `error` — mock catalog data is never presented as live.
 *   - Only safe, already-mapped domain objects and coarse pagination metadata
 *     cross the boundary; the UI never sees a raw row.
 *
 * Dependencies (Supabase table client, clock, logger) are injectable so the
 * flow is unit-testable without a live database.
 */

import type { MediaItem } from "@/lib/types";
import type { SearchKindFilter } from "@/lib/search/config";
import { kindFilterToKind, parseKindFilter } from "@/lib/search/query";
import {
  BROWSE_PAGE_SIZE,
  normalizeGenreKey,
  orderColumnsForSort,
  parseBrowsePage,
  parseBrowseSort,
  parseGenreParam,
  type BrowseSort,
} from "@/lib/browse/query";
import {
  browseResultCountBucket,
  latencyBucket,
  logBrowse,
  type BrowseLogFields,
  type BrowseOutcomeKind,
} from "@/lib/browse/log";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";
import { mapMediaRowToDomain, type MediaItemRow } from "./mappers";
import {
  totalPagesFor,
  type BrowseOutcome,
  type BrowsePagination,
} from "./browse-view-model";

/** A concrete media kind, or `null` for no media-type narrowing. */
type DbKind = "movie" | "tv" | "book" | null;

/** A coarse database error shape (never exposes internal details). */
type DbError = { message?: string } | null;

/**
 * The narrow port the browse service needs. Keeping it small means the service
 * can be unit-tested with a trivial fake and the real Supabase query-builder
 * chain lives in exactly one adapter ({@link defaultGetClient}).
 */
export interface BrowseTableClient {
  /**
   * Fetch the `genres` arrays for every catalog row of the given kind (or all
   * kinds when `null`). Used to derive the available-genre control values and
   * to reconcile a requested genre. Genre filtering is intentionally NOT
   * applied here, so switching genres never hides the other options.
   */
  fetchGenres(
    kind: DbKind,
  ): Promise<{ data: Array<{ genres: string[] }> | null; error: DbError }>;
  /** Fetch one ordered, filtered page plus the exact total count. */
  fetchPage(input: {
    kind: DbKind;
    genre: string | null;
    sort: BrowseSort;
    from: number;
    to: number;
  }): Promise<{
    data: MediaItemRow[] | null;
    count: number | null;
    error: DbError;
  }>;
}

/** Injectable dependencies (all optional; production defaults are used). */
export interface BrowseDeps {
  getClient?: () => Promise<BrowseTableClient>;
  now?: () => number;
  log?: (fields: BrowseLogFields) => void;
}

/** Untrusted browse inputs — each is parsed/allow-listed inside the service. */
export interface BrowseInput {
  kind?: unknown;
  sort?: unknown;
  page?: unknown;
  genre?: unknown;
}

/** Minimal structural view of the Supabase query builder chain we use. */
interface DbResult {
  data: unknown;
  error: DbError;
  count?: number | null;
}
interface BrowseQueryBuilder extends PromiseLike<DbResult> {
  select(
    columns: string,
    options?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ): BrowseQueryBuilder;
  eq(column: string, value: string): BrowseQueryBuilder;
  contains(column: string, value: string[]): BrowseQueryBuilder;
  order(
    column: string,
    options: { ascending: boolean; nullsFirst?: boolean },
  ): BrowseQueryBuilder;
  range(from: number, to: number): BrowseQueryBuilder;
}
interface BrowseSupabase {
  from(table: string): BrowseQueryBuilder;
}

/**
 * Production adapter: bind the narrow {@link BrowseTableClient} port to the real
 * per-request SSR client. This is the one place the Supabase query-builder chain
 * is assembled; the ordering plan comes from the audited, pure
 * {@link orderColumnsForSort}.
 */
async function defaultGetClient(): Promise<BrowseTableClient> {
  const supabase = (await createClient()) as unknown as BrowseSupabase;
  return {
    async fetchGenres(kind) {
      let q = supabase.from("media_items").select("genres");
      if (kind) q = q.eq("kind", kind);
      const res = await q;
      return {
        data: (res.data as Array<{ genres: string[] }> | null) ?? null,
        error: res.error,
      };
    },
    async fetchPage({ kind, genre, sort, from, to }) {
      let q = supabase.from("media_items").select("*", { count: "exact" });
      if (kind) q = q.eq("kind", kind);
      if (genre) q = q.contains("genres", [genre]);
      for (const oc of orderColumnsForSort(sort)) {
        q = q.order(oc.column, {
          ascending: oc.ascending,
          nullsFirst: oc.nullsFirst,
        });
      }
      const res = await q.range(from, to);
      return {
        data: (res.data as MediaItemRow[] | null) ?? null,
        count: res.count ?? null,
        error: res.error,
      };
    },
  };
}

/** Distinct, trimmed, alphabetically-sorted genres (canonical stored casing). */
function distinctSortedGenres(rows: Array<{ genres: string[] }>): string[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const genres = Array.isArray(row?.genres) ? row.genres : [];
    for (const raw of genres) {
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      const key = normalizeGenreKey(trimmed);
      if (!byKey.has(key)) byKey.set(key, trimmed);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Reconcile a requested genre against the real available genres. Returns the
 * canonical stored casing when it matches (case/whitespace-insensitively), or
 * `null` when absent/unknown — a safe reset for an incompatible parameter.
 */
function reconcileGenre(
  requested: string | null,
  available: string[],
): string | null {
  if (!requested) return null;
  const key = normalizeGenreKey(requested);
  return available.find((g) => normalizeGenreKey(g) === key) ?? null;
}

/** Map rows to domain items, skipping any malformed row rather than throwing. */
function mapRowsSafely(rows: MediaItemRow[]): MediaItem[] {
  return rows.flatMap((row) => {
    try {
      return [mapMediaRowToDomain(row)];
    } catch {
      return [];
    }
  });
}

/**
 * Browse the real catalog and return a discriminated {@link BrowseOutcome}.
 */
export async function browseCatalog(
  input: BrowseInput,
  deps: BrowseDeps = {},
): Promise<BrowseOutcome> {
  const now = deps.now ?? (() => performance.now());
  const log = deps.log ?? logBrowse;
  const startedAt = now();

  const kind: SearchKindFilter = parseKindFilter(input.kind);
  const sort = parseBrowseSort(input.sort);
  const requestedPage = parseBrowsePage(input.page);
  const requestedGenre = parseGenreParam(input.genre);
  const dbKind = kindFilterToKind(kind);
  const pageSize = BROWSE_PAGE_SIZE;

  const emit = (
    outcome: BrowseOutcomeKind,
    over: Partial<BrowseLogFields> = {},
  ) => {
    log({
      outcome,
      sort,
      mediaType: kind,
      genreFiltered: false,
      page: requestedPage,
      totalPages: 0,
      resultCountBucket: browseResultCountBucket(0),
      latencyBucket: latencyBucket(now() - startedAt),
      ...over,
    });
  };

  if (!isSupabaseConfigured()) {
    emit("unavailable");
    return { status: "unavailable" };
  }

  let client: BrowseTableClient;
  try {
    client = await (deps.getClient ?? defaultGetClient)();
  } catch {
    emit("error");
    return { status: "error", category: "client" };
  }

  // 1. Available genres for the current media type (no genre filter applied).
  const genresRes = await client.fetchGenres(dbKind);
  if (genresRes.error) {
    emit("error");
    return { status: "error", category: "database" };
  }
  const availableGenres = distinctSortedGenres(genresRes.data ?? []);
  const appliedGenre = reconcileGenre(requestedGenre, availableGenres);

  // 2. Fetch the requested page (with exact count), then clamp to the real
  //    number of pages and re-fetch once if the request was out of range.
  const pageRange = (page: number) => ({
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
  });

  const first = await client.fetchPage({
    kind: dbKind,
    genre: appliedGenre,
    sort,
    ...pageRange(requestedPage),
  });
  if (first.error) {
    emit("error", { genreFiltered: appliedGenre !== null });
    return { status: "error", category: "database" };
  }

  let totalCount = first.count ?? first.data?.length ?? 0;
  let totalPages = totalPagesFor(totalCount, pageSize);
  let page = requestedPage;
  let rows = first.data ?? [];

  if (page > totalPages) {
    page = totalPages;
    const refetch = await client.fetchPage({
      kind: dbKind,
      genre: appliedGenre,
      sort,
      ...pageRange(page),
    });
    if (refetch.error) {
      emit("error", { genreFiltered: appliedGenre !== null });
      return { status: "error", category: "database" };
    }
    totalCount = refetch.count ?? totalCount;
    totalPages = totalPagesFor(totalCount, pageSize);
    rows = refetch.data ?? [];
  }

  const items = mapRowsSafely(rows);

  const pagination: BrowsePagination = {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };

  emit("ok", {
    genreFiltered: appliedGenre !== null,
    page,
    totalPages,
    resultCountBucket: browseResultCountBucket(items.length),
  });

  return {
    status: "ok",
    items,
    kind,
    sort,
    appliedGenre,
    availableGenres,
    pagination,
  };
}
