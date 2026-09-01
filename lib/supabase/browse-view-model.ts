/**
 * Result contract for Explore *browse* mode.
 *
 * The browse DAL returns a discriminated {@link BrowseOutcome} the Explore
 * surface renders from directly — mirroring the search outcome shape so the two
 * modes share an accessible-state vocabulary (ok / unavailable / error). Only
 * safe, already-mapped domain objects and coarse pagination metadata cross this
 * boundary; the UI never sees a raw database row.
 */

import type { MediaItem } from "@/lib/types";
import type { SearchKindFilter } from "@/lib/search/config";
import type { BrowseSort } from "@/lib/browse/query";

/** Coarse, stable pagination metadata for the current browse view. */
export interface BrowsePagination {
  /** 1-based current page (already clamped to `[1, totalPages]`). */
  page: number;
  /** Bounded, constant page size. */
  pageSize: number;
  /** Total matching titles across all pages for the current filter set. */
  totalCount: number;
  /** Total number of pages (>= 1, even when empty). */
  totalPages: number;
  /** Whether a previous page exists. */
  hasPrev: boolean;
  /** Whether a next page exists. */
  hasNext: boolean;
}

/** A successful browse read with an ordered, paginated result set. */
export interface BrowseSuccess {
  status: "ok";
  /** Ordered catalog results for the current page. */
  items: MediaItem[];
  /** Allow-listed media-type filter applied. */
  kind: SearchKindFilter;
  /** Global sort applied. */
  sort: BrowseSort;
  /**
   * The reconciled genre filter actually applied, or `null` when none/dropped.
   * A requested genre that does not exist for the current media type is reset
   * to `null` (safe reset), so this reflects reality, not the raw request.
   */
  appliedGenre: string | null;
  /**
   * Distinct genres available for the current media type (alphabetical), for
   * the genre control. Derived from real stored catalog values.
   */
  availableGenres: string[];
  pagination: BrowsePagination;
}

/** Supabase is not configured — the caller should preserve no-env browsing. */
export interface BrowseUnavailable {
  status: "unavailable";
}

/** The browse read failed safely; `category` is a coarse, non-sensitive label. */
export interface BrowseError {
  status: "error";
  category: string;
}

/** The discriminated outcome the Explore browse surface renders from. */
export type BrowseOutcome = BrowseSuccess | BrowseUnavailable | BrowseError;

/**
 * Compute the total number of pages for a count + page size. Always at least 1
 * (an empty catalog still has a single, empty page), so pagination metadata is
 * never degenerate.
 */
export function totalPagesFor(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  const safeCount =
    Number.isFinite(totalCount) && totalCount > 0 ? totalCount : 0;
  return Math.max(1, Math.ceil(safeCount / pageSize));
}
