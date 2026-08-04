import type { List } from "@/lib/types";
import { getListMedia, getListOwner } from "@/lib/data";
import type { ListCardView } from "@/components/lists/list-view";

/** How many covers a card fans out in its preview. */
const PREVIEW_COVER_COUNT = 5;

/**
 * Resolve a stored `List` into the flat, serializable `ListCardView` the
 * discovery surface renders.
 *
 * This runs on the server (it reaches into the data layer to resolve the owner
 * and the list's media), so the Client Component that filters cards never has
 * to import the raw catalog, user, or list arrays. Returns `null` for a list
 * whose owner cannot be resolved so callers can skip an orphaned record.
 */
export function toListCardView(list: List): ListCardView | null {
  const owner = getListOwner(list);
  if (!owner) return null;

  const media = getListMedia(list);
  const kinds = [...new Set(media.map((item) => item.kind))];

  return {
    id: list.id,
    slug: list.slug,
    title: list.title,
    description: list.description,
    itemCount: media.length,
    likeCount: list.likeCount,
    isRanked: list.isRanked,
    owner: {
      displayName: owner.displayName,
      handle: owner.handle,
      avatarUrl: owner.avatarUrl,
    },
    covers: media.slice(0, PREVIEW_COVER_COUNT).map((item) => ({
      id: item.id,
      title: item.title,
      posterUrl: item.posterUrl,
    })),
    kinds,
  };
}
