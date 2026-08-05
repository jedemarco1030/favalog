import type { MediaKind } from "@/lib/types";

/**
 * A single cover in a list's editorial preview. Kept to just what the preview
 * needs (artwork + a title for the fallback alt) so the discovery surface
 * never carries the full `MediaItem`.
 */
export interface ListPreviewCover {
  id: string;
  title: string;
  posterUrl: string;
}

/**
 * A fully-resolved, serializable list summary used by `ListCard`.
 *
 * The Server Component resolves the owner and the list's media into this flat
 * shape before handing it to the client discovery surface, so the interactive
 * layer never imports the raw catalog, user, or list arrays — it only filters
 * the array it is given (mirroring the Diary/Explore view-model pattern).
 */
export interface ListCardView {
  id: string;
  slug: string;
  title: string;
  description?: string;
  itemCount: number;
  likeCount: number;
  isRanked: boolean;
  owner: {
    displayName: string;
    username: string;
    avatarUrl: string;
  };
  /** Up to a handful of covers for the editorial preview, in list order. */
  covers: ListPreviewCover[];
  /** Distinct media kinds present in the list, for a "mixed media" hint. */
  kinds: MediaKind[];
}

/**
 * Human, pluralized "N items" / "1 item" label for a list's size. Centralized
 * so every list surface phrases the count identically.
 */
export function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

/** Human, pluralized "N likes" / "1 like" label. */
export function likeCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "like" : "likes"}`;
}
