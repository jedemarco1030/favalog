/**
 * Result contract for catalog search + mapping from the search RPC rows to the
 * `MediaItem` domain union.
 *
 * The `keyword_search` / `semantic_search` / `hybrid_search` functions all
 * return the same safe projection (catalog fields + a `rank` scalar, never a
 * vector). This module maps one of those rows into the strict domain model the
 * UI already renders, reusing {@link mapMediaRowToDomain} so the kind-narrowing
 * logic lives in exactly one place.
 */

import type { Database } from "@/lib/database.types";
import type { MediaItem } from "@/lib/types";
import type { SearchKindFilter, SearchMode } from "@/lib/search/config";
import type { FallbackReason } from "@/lib/search/log";
import { mapMediaRowToDomain, type MediaItemRow } from "./mappers";

/** A single row as returned by any of the three search functions. */
export type SearchRpcRow =
  Database["public"]["Functions"]["keyword_search"]["Returns"][number];

/** Successful search with an ordered, safe result set. */
export interface SearchSuccess {
  status: "ok";
  /** The normalized query that was executed. */
  query: string;
  /** The allow-listed kind filter that was applied. */
  kind: SearchKindFilter;
  /** The retrieval mode that produced these results. */
  mode: SearchMode;
  /** Ordered catalog results (already limited). */
  items: MediaItem[];
  count: number;
  /** Present only when the search fell back to keyword-only. */
  fallbackReason?: FallbackReason;
}

/** The query was empty/invalid — no search ran (and no provider was called). */
export interface SearchEmpty {
  status: "empty";
}

/** Supabase is not configured — the caller should preserve no-env browsing. */
export interface SearchUnavailable {
  status: "unavailable";
}

/** The search failed safely; `category` is a coarse, non-sensitive label. */
export interface SearchError {
  status: "error";
  category: string;
}

/** The discriminated outcome the Explore surface renders from. */
export type SearchOutcome =
  SearchSuccess | SearchEmpty | SearchUnavailable | SearchError;

/**
 * Map a search RPC row to a full {@link MediaItem}.
 *
 * The RPC projection omits internal-only columns (`source`, `external_id`,
 * timestamps, the tsvector). We synthesize a minimal {@link MediaItemRow} from
 * the safe fields and delegate to the shared mapper, so the domain object is
 * built identically to every other read path.
 */
export function mapSearchRowToMediaItem(row: SearchRpcRow): MediaItem {
  const mediaRow: MediaItemRow = {
    id: row.media_id,
    kind: row.kind,
    source: "favalog",
    external_id: row.media_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    synopsis: row.synopsis,
    year: row.year,
    poster_url: row.poster_url,
    backdrop_url: row.backdrop_url,
    average_rating: row.average_rating,
    genres: row.genres,
    details: row.details,
    created_at: "",
    updated_at: "",
    // The generated tsvector is not part of the projection; the mapper ignores it.
    search_tsv: null as unknown as MediaItemRow["search_tsv"],
  };
  return mapMediaRowToDomain(mediaRow);
}

/** Map many rows, preserving rank order. */
export function mapSearchRowsToMediaItems(rows: SearchRpcRow[]): MediaItem[] {
  return rows.map(mapSearchRowToMediaItem);
}
