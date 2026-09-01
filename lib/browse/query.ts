/**
 * Pure URL-parameter parsing + ordering plan for the Explore *browse* mode.
 *
 * Browse mode is the real, server-backed catalog browser shown on `/explore`
 * when Supabase is configured and no search query (`q`) is active. Unlike
 * hybrid search — whose ordering is relevance and must never be re-sorted
 * client-side — browse applies a deterministic GLOBAL sort over the whole
 * catalog with bounded pagination.
 *
 * Everything here is pure and I/O-free so it can be unit-tested and shared
 * between the server page, the browse DAL, and the client controls. Every value
 * is strictly allow-listed: an unknown sort, an out-of-range page, or a
 * malformed genre all reset SAFELY to a well-defined default rather than
 * reaching the database as-is. No client-supplied SQL, column names, or
 * ordering directions are ever accepted — only an allow-listed sort key.
 *
 * Media-type parsing is deliberately reused from `@/lib/search/query`
 * (`parseKindFilter` / `kindFilterToKind`) so browse and search share one
 * allow-listed `type` contract.
 */

/** The allow-listed global browse sorts, in display order. */
export const BROWSE_SORTS = [
  "recently_added",
  "highest_rated",
  "newest",
  "oldest",
  "title_asc",
] as const;

/** A validated global browse sort key. */
export type BrowseSort = (typeof BROWSE_SORTS)[number];

/** Default sort when none/an unknown one is supplied. */
export const DEFAULT_BROWSE_SORT: BrowseSort = "recently_added";

/**
 * Page size for browse pagination. Bounded and constant so the database work
 * per request is predictable regardless of catalog growth.
 */
export const BROWSE_PAGE_SIZE = 24 as const;

/**
 * Hard upper bound on a *requested* page number before it is further clamped to
 * the actual number of pages by the DAL. Guards against an absurd `?page=` that
 * would compute a huge offset.
 */
export const MAX_BROWSE_PAGE = 500 as const;

/** Maximum accepted length of a raw genre parameter (post-trim). */
export const MAX_GENRE_LENGTH = 60 as const;

const VALID_SORTS: ReadonlySet<BrowseSort> = new Set(BROWSE_SORTS);

/** First value when a URL parameter may arrive as a repeated (array) param. */
function firstParam(raw: unknown): unknown {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Parse an untrusted `sort` parameter into an allow-listed {@link BrowseSort}.
 * Anything unrecognised collapses to {@link DEFAULT_BROWSE_SORT}.
 */
export function parseBrowseSort(raw: unknown): BrowseSort {
  const value = firstParam(raw);
  if (typeof value === "string" && VALID_SORTS.has(value as BrowseSort)) {
    return value as BrowseSort;
  }
  return DEFAULT_BROWSE_SORT;
}

/**
 * Parse an untrusted `page` parameter into a 1-based page in
 * `[1, MAX_BROWSE_PAGE]`. Non-numeric, fractional-below-1, zero, negative, or
 * absurdly large values reset to `1` / the ceiling. The DAL further clamps this
 * to the real number of pages once the total count is known.
 */
export function parseBrowsePage(raw: unknown): number {
  const value = firstParam(raw);
  const n =
    typeof value === "string"
      ? Number.parseInt(value, 10)
      : typeof value === "number"
        ? value
        : NaN;
  if (!Number.isFinite(n)) return 1;
  const floored = Math.floor(n);
  if (floored < 1) return 1;
  if (floored > MAX_BROWSE_PAGE) return MAX_BROWSE_PAGE;
  return floored;
}

/**
 * Parse an untrusted `genre` parameter into a trimmed non-empty string, or
 * `null` when absent/blank/too long. This does NOT prove the genre exists in
 * the catalog — the DAL reconciles it against the real stored genres (and drops
 * it safely if incompatible). Returning the raw trimmed value keeps parsing
 * pure and case-preserving for display.
 */
export function parseGenreParam(raw: unknown): string | null {
  const value = firstParam(raw);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_GENRE_LENGTH) return null;
  return trimmed;
}

/** Case/whitespace-insensitive comparison key for a genre value. */
export function normalizeGenreKey(genre: string): string {
  return genre.trim().toLowerCase();
}

/** One column directive in a deterministic ordering plan. */
export interface OrderColumn {
  column: "created_at" | "average_rating" | "year" | "title" | "id";
  ascending: boolean;
  /** Only meaningful for a nullable column (e.g. `average_rating`). */
  nullsFirst?: boolean;
}

/**
 * The deterministic ordering plan for a browse sort.
 *
 * Every plan ENDS with a unique `id` tie-breaker so the total order is stable
 * and pagination can never drop or duplicate a row when the primary key ties
 * (e.g. two titles from the same release year, or the same import timestamp).
 * Nullable primary columns push nulls last so unrated titles never crowd out
 * rated ones under "Highest rated".
 */
export function orderColumnsForSort(sort: BrowseSort): OrderColumn[] {
  switch (sort) {
    case "recently_added":
      return [
        { column: "created_at", ascending: false },
        { column: "id", ascending: false },
      ];
    case "highest_rated":
      return [
        { column: "average_rating", ascending: false, nullsFirst: false },
        { column: "id", ascending: true },
      ];
    case "newest":
      return [
        { column: "year", ascending: false },
        { column: "id", ascending: true },
      ];
    case "oldest":
      return [
        { column: "year", ascending: true },
        { column: "id", ascending: true },
      ];
    case "title_asc":
      return [
        { column: "title", ascending: true },
        { column: "id", ascending: true },
      ];
    default: {
      // Exhaustiveness guard: `sort` is a bounded union.
      const exhaustive: never = sort;
      throw new Error(`Unknown browse sort: ${String(exhaustive)}`);
    }
  }
}
