/**
 * Pure database-row -> view-model mappers for real (persistent) lists.
 *
 * Kept free of any server/Supabase/React import so they can be unit-tested in
 * isolation, mirroring `mappers.ts`. The UI never sees a raw database row: the
 * server reads in `lists.ts` resolve rows and hand these serializable view
 * models to Server Components. Real lists deliberately carry NO like count and
 * NO curator notes in this phase (both are out of scope), so those fields are
 * simply absent here rather than faked.
 */

import type { ListVisibility, MediaKind } from "@/lib/types";

/** Narrow a stored visibility string to the domain union, failing closed. */
export function normalizeStoredVisibility(value: string): ListVisibility {
  return value === "public" || value === "followers" || value === "private"
    ? value
    : "private";
}

/** The minimal list-row fields the summary/detail mappers need. */
export interface ListRowLike {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: string;
  is_ranked: boolean;
  updated_at: string;
}

/** A compact list card view for the lists index / profile / dialog. */
export interface ListSummaryView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: ListVisibility;
  isRanked: boolean;
  itemCount: number;
  updatedAt: string;
}

/** A list summary plus whether a specific title is a member (dialog use). */
export interface ListMembershipView extends ListSummaryView {
  /** True when the title in question is already in this list. */
  containsMedia: boolean;
}

/** One ordered catalog item within a real list. */
export interface ListDetailItemView {
  mediaId: string;
  position: number;
  slug: string;
  title: string;
  year: number;
  kind: MediaKind;
  posterUrl: string;
}

/** A real list's owner identity (stored fields only). */
export interface ListOwnerView {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** The full real list-detail view for /list/[slug]. */
export interface ListDetailView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: ListVisibility;
  isRanked: boolean;
  updatedAt: string;
  owner: ListOwnerView;
  items: ListDetailItemView[];
  /** True only when the current viewer owns the list (drives mutation UI). */
  isOwner: boolean;
}

/** Map a list row + resolved item count to a {@link ListSummaryView}. */
export function toListSummaryView(
  row: ListRowLike,
  itemCount: number,
): ListSummaryView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    visibility: normalizeStoredVisibility(row.visibility),
    isRanked: row.is_ranked,
    itemCount: Math.max(0, Math.trunc(itemCount)),
    updatedAt: row.updated_at,
  };
}

/** Map a list row to a {@link ListMembershipView} for the add-to-list dialog. */
export function toListMembershipView(
  row: ListRowLike,
  itemCount: number,
  containsMedia: boolean,
): ListMembershipView {
  return { ...toListSummaryView(row, itemCount), containsMedia };
}

/** The minimal item-row fields the detail item mapper needs. */
export interface ListItemRowLike {
  media_id: string;
  position: number;
  media_items: {
    slug: string;
    title: string;
    year: number;
    kind: MediaKind;
    poster_url: string | null;
  };
}

/** Map an ordered list_items row (joined to its media) to an item view. */
export function toListDetailItemView(row: ListItemRowLike): ListDetailItemView {
  return {
    mediaId: row.media_id,
    position: row.position,
    slug: row.media_items.slug,
    title: row.media_items.title,
    year: row.media_items.year,
    kind: row.media_items.kind,
    posterUrl: row.media_items.poster_url ?? "",
  };
}

/** The minimal owner-row fields the detail mapper needs. */
export interface ListOwnerRowLike {
  username: string;
  display_name: string;
  avatar_url: string | null;
}

/**
 * Assemble a {@link ListDetailView} from its list row, owner row, ordered item
 * rows, and the viewer-ownership flag (derived server-side, never trusted from
 * the client). Items are sorted by position so the stored order — which doubles
 * as the ranking for ranked lists — is authoritative.
 */
export function toListDetailView(
  row: ListRowLike,
  owner: ListOwnerRowLike,
  items: ListItemRowLike[],
  isOwner: boolean,
): ListDetailView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    visibility: normalizeStoredVisibility(row.visibility),
    isRanked: row.is_ranked,
    updatedAt: row.updated_at,
    owner: {
      username: owner.username,
      displayName: owner.display_name,
      avatarUrl: owner.avatar_url ?? null,
    },
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map(toListDetailItemView),
    isOwner,
  };
}
