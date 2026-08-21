/**
 * Pure database-row -> view-model mappers for real (persistent) favorites.
 *
 * Kept free of any server/Supabase/React import so they can be unit-tested in
 * isolation, mirroring `list-view-model.ts`. The UI never sees a raw database
 * row: the server reads in `favorites.ts` resolve rows and hand these
 * serializable view models to Server Components.
 *
 * Each favorite embeds its full catalog `MediaItem`, mapped through the SAME
 * `mapMediaRowToDomain` boundary the rest of the persistence layer uses, so
 * real favorites render through the established cross-media UI (`MediaCard` /
 * `HorizontalMediaRow`) with no fabricated mock records.
 */

import type { MediaItem } from "@/lib/types";
import { mapMediaRowToDomain, type MediaItemRow } from "./mappers";

/** One favorite: its stored position plus the resolved catalog media. */
export interface FavoriteView {
  /** The favorite's own row id (stable identifier). */
  id: string;
  /** Zero-based position on the owner's ordered favorites shelf. */
  position: number;
  /** The resolved catalog title, mapped to the domain `MediaItem` union. */
  media: MediaItem;
}

/** The minimal favorite-row fields the mapper needs (joined to its media). */
export interface FavoriteRowLike {
  id: string;
  position: number;
  media_items: MediaItemRow;
}

/** Map one favorites row (joined to its media) to a {@link FavoriteView}. */
export function toFavoriteView(row: FavoriteRowLike): FavoriteView {
  return {
    id: row.id,
    position: row.position,
    media: mapMediaRowToDomain(row.media_items),
  };
}

/**
 * Map many favorite rows to ordered {@link FavoriteView}s, sorted by the stored
 * `position` so the owner's deliberate shelf order is authoritative regardless
 * of the query's row order.
 */
export function toFavoriteViews(rows: FavoriteRowLike[]): FavoriteView[] {
  return [...rows].sort((a, b) => a.position - b.position).map(toFavoriteView);
}
