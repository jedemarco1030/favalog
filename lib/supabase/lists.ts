import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import type { MediaKind } from "@/lib/types";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import {
  validateCreateListInput,
  validateListItemInput,
  type CreateListInput,
  type ListFieldErrors,
  type ListItemInput,
} from "./list-input";
import {
  GENERIC_ADD_ITEM_ERROR,
  GENERIC_CREATE_LIST_ERROR,
  GENERIC_REMOVE_ITEM_ERROR,
  mapAddItemError,
  mapCreateListError,
  mapRemoveItemError,
} from "./list-errors";
import {
  toListDetailView,
  toListMembershipView,
  toListSummaryView,
  type ListDetailView,
  type ListItemRowLike,
  type ListMembershipView,
  type ListOwnerView,
  type ListSummaryView,
} from "./list-view-model";

export {
  mapCreateListError,
  mapAddItemError,
  mapRemoveItemError,
} from "./list-errors";

/**
 * Server-side write + read paths for persistent lists.
 *
 * The writes mirror the diary write layer in `log.ts`: each one refuses to run
 * without Supabase configured (a controlled "unavailable" state so no-env
 * builds never crash), independently re-validates the authenticated user AND
 * profile completeness via the server-only auth DAL (never trusting the
 * client), re-validates/normalizes input server-side, delegates the atomic
 * write to a SECURITY INVOKER RPC (ownership from auth.uid(), RLS in force),
 * treats a missing/malformed RPC identifier as a failure, and maps raw
 * Supabase/Postgres errors to safe messages. Reads are owner/visibility-scoped
 * by RLS and return serializable view models — never raw rows.
 */

// ---------------------------------------------------------------------------
// Revalidation
// ---------------------------------------------------------------------------

/**
 * Revalidate every surface that reflects a list write: the lists index, the
 * affected real list route (by server-returned canonical slug), the title page
 * (when a title was involved), and the author's own real profile. The username
 * is resolved from the server-side auth DAL — never a client value — so a caller
 * can't trigger revalidation of another user's route.
 */
async function revalidateListWrite(opts: {
  slug?: string | null;
  mediaSlug?: string | null;
}): Promise<void> {
  revalidatePath("/lists");
  if (opts.slug) revalidatePath(`/list/${opts.slug}`);
  if (opts.mediaSlug) revalidatePath(`/title/${opts.mediaSlug}`);
  const profile = await getCurrentProfile();
  if (profile) revalidatePath(`/profile/${profile.username}`);
}

/** Re-check authentication and profile completeness for a write path. */
async function requireOnboardedUser(): Promise<
  { ok: true } | { ok: false; status: "unauthenticated" | "incomplete-profile" }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: "unauthenticated" };
  const profile = await getCurrentProfile();
  if (!profile || !isProfileComplete(profile)) {
    return { ok: false, status: "incomplete-profile" };
  }
  return { ok: true };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ---------------------------------------------------------------------------
// create_list
// ---------------------------------------------------------------------------

export type CreateListResult =
  | {
      status: "success";
      listId: string;
      slug: string;
      addedMediaSlug: string | null;
    }
  | { status: "unauthenticated" }
  | { status: "incomplete-profile" }
  | { status: "unavailable" }
  | { status: "invalid"; errors: ListFieldErrors }
  | { status: "error"; message: string };

interface CreateListRpcResult {
  list_id?: string;
  slug?: string;
  added_media_slug?: string | null;
}

/** Create a list for the current user, optionally adding one trusted title. */
export async function createList(
  input: CreateListInput,
): Promise<CreateListResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const auth = await requireOnboardedUser();
  if (!auth.ok) return { status: auth.status };

  const validation = validateCreateListInput(input);
  if (!validation.ok || !validation.value) {
    return { status: "invalid", errors: validation.errors };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_list", {
    p_title: value.title,
    p_description: value.description ?? undefined,
    p_is_ranked: value.isRanked,
    p_visibility: value.visibility,
    p_media_slug: value.mediaSlug ?? undefined,
  });

  if (error) return { status: "error", message: mapCreateListError(error) };

  const result = (data ?? {}) as CreateListRpcResult;
  const listId = asString(result.list_id);
  const slug = asString(result.slug);
  // Defensive success contract: without a real id AND canonical slug the write
  // may not have completed as expected; never report a false success.
  if (listId === "" || slug === "") {
    return { status: "error", message: GENERIC_CREATE_LIST_ERROR };
  }

  const addedMediaSlug =
    typeof result.added_media_slug === "string" &&
    result.added_media_slug.trim() !== ""
      ? result.added_media_slug.trim()
      : null;

  await revalidateListWrite({ slug, mediaSlug: addedMediaSlug });

  return { status: "success", listId, slug, addedMediaSlug };
}

// ---------------------------------------------------------------------------
// add_list_item
// ---------------------------------------------------------------------------

export type AddListItemResult =
  | {
      status: "success";
      listId: string;
      slug: string;
      mediaId: string;
      position: number;
      alreadyPresent: boolean;
    }
  | { status: "unauthenticated" }
  | { status: "incomplete-profile" }
  | { status: "unavailable" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

interface AddListItemRpcResult {
  list_id?: string;
  slug?: string;
  media_id?: string;
  position?: number;
  already_present?: boolean;
}

/** Add a trusted catalog title to a list owned by the current user. */
export async function addListItem(
  input: ListItemInput,
): Promise<AddListItemResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const auth = await requireOnboardedUser();
  if (!auth.ok) return { status: auth.status };

  const validation = validateListItemInput(input);
  if (!validation.ok || !validation.value) {
    return {
      status: "invalid",
      message: validation.message ?? GENERIC_ADD_ITEM_ERROR,
    };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_list_item", {
    p_list_id: value.listId,
    p_media_slug: value.mediaSlug,
  });

  if (error) return { status: "error", message: mapAddItemError(error) };

  const result = (data ?? {}) as AddListItemRpcResult;
  const slug = asString(result.slug);
  const mediaId = asString(result.media_id);
  if (slug === "" || mediaId === "") {
    return { status: "error", message: GENERIC_ADD_ITEM_ERROR };
  }

  await revalidateListWrite({ slug, mediaSlug: value.mediaSlug });

  return {
    status: "success",
    listId: value.listId,
    slug,
    mediaId,
    position: typeof result.position === "number" ? result.position : 0,
    alreadyPresent: result.already_present === true,
  };
}

// ---------------------------------------------------------------------------
// remove_list_item
// ---------------------------------------------------------------------------

export type RemoveListItemResult =
  | {
      status: "success";
      listId: string;
      slug: string;
      mediaId: string;
      removed: boolean;
    }
  | { status: "unauthenticated" }
  | { status: "incomplete-profile" }
  | { status: "unavailable" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

interface RemoveListItemRpcResult {
  list_id?: string;
  slug?: string;
  media_id?: string;
  removed?: boolean;
}

/** Remove a title from a list owned by the current user, compacting positions. */
export async function removeListItem(
  input: ListItemInput,
): Promise<RemoveListItemResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const auth = await requireOnboardedUser();
  if (!auth.ok) return { status: auth.status };

  const validation = validateListItemInput(input);
  if (!validation.ok || !validation.value) {
    return {
      status: "invalid",
      message: validation.message ?? GENERIC_REMOVE_ITEM_ERROR,
    };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_list_item", {
    p_list_id: value.listId,
    p_media_slug: value.mediaSlug,
  });

  if (error) return { status: "error", message: mapRemoveItemError(error) };

  const result = (data ?? {}) as RemoveListItemRpcResult;
  const slug = asString(result.slug);
  const mediaId = asString(result.media_id);
  if (slug === "" || mediaId === "") {
    return { status: "error", message: GENERIC_REMOVE_ITEM_ERROR };
  }

  await revalidateListWrite({ slug, mediaSlug: value.mediaSlug });

  return {
    status: "success",
    listId: value.listId,
    slug,
    mediaId,
    removed: result.removed === true,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface ListWithCountRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: string;
  is_ranked: boolean;
  updated_at: string;
  list_items: { count: number }[] | null;
}

function countOf(row: ListWithCountRow): number {
  return Array.isArray(row.list_items) ? (row.list_items[0]?.count ?? 0) : 0;
}

export type MyListsWithMembershipResult =
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "error" }
  | { status: "ok"; mediaKnown: boolean; lists: ListMembershipView[] };

/**
 * The current user's own lists plus whether each already contains the title
 * with `mediaSlug`. Powers the add-to-list dialog. Never exposes another user's
 * lists (owner-scoped query).
 */
export async function getMyListsWithMembership(
  mediaSlug: string,
): Promise<MyListsWithMembershipResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const user = await getCurrentUser();
  if (!user) return { status: "signed-out" };

  const supabase = await createClient();

  const { data: mediaRow } = await supabase
    .from("media_items")
    .select("id")
    .eq("slug", mediaSlug)
    .maybeSingle();
  const mediaId = mediaRow?.id ?? null;

  const { data, error } = await supabase
    .from("lists")
    .select(
      "id, slug, title, description, visibility, is_ranked, updated_at, list_items(count)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as ListWithCountRow[];

  let memberListIds = new Set<string>();
  if (mediaId) {
    const { data: memberRows } = await supabase
      .from("list_items")
      .select("list_id")
      .eq("media_id", mediaId);
    memberListIds = new Set(
      ((memberRows ?? []) as { list_id: string }[]).map((r) => r.list_id),
    );
  }

  const lists = rows.map((row) =>
    toListMembershipView(row, countOf(row), memberListIds.has(row.id)),
  );

  return { status: "ok", mediaKnown: mediaId !== null, lists };
}

export type MyListsResult =
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "error" }
  | { status: "ok"; lists: ListSummaryView[] };

/** The current user's own lists, newest first. */
export async function getMyLists(): Promise<MyListsResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const user = await getCurrentUser();
  if (!user) return { status: "signed-out" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .select(
      "id, slug, title, description, visibility, is_ranked, updated_at, list_items(count)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as ListWithCountRow[];
  return {
    status: "ok",
    lists: rows.map((r) => toListSummaryView(r, countOf(r))),
  };
}

/** A public list card plus its owner identity, for the community section. */
export interface PublicListView extends ListSummaryView {
  owner: ListOwnerView;
}

export type PublicListsResult =
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; lists: PublicListView[] };

interface PublicListRow extends ListWithCountRow {
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

/**
 * Public real lists (any owner), newest first, for the "Community lists"
 * section. RLS already restricts the select to public (or owned) lists; the
 * `.eq("visibility", "public")` filter keeps the section strictly public so an
 * owner's private lists never leak into a shared discovery surface.
 */
export async function getPublicLists(limit = 12): Promise<PublicListsResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .select(
      "id, slug, title, description, visibility, is_ranked, updated_at, list_items(count), profiles!inner(username, display_name, avatar_url)",
    )
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as PublicListRow[];
  const lists: PublicListView[] = rows
    .filter((r) => r.profiles !== null)
    .map((r) => ({
      ...toListSummaryView(r, countOf(r)),
      owner: {
        username: r.profiles!.username,
        displayName: r.profiles!.display_name,
        avatarUrl: r.profiles!.avatar_url ?? null,
      },
    }));

  return { status: "ok", lists };
}

export type RealListResult =
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "ok"; list: ListDetailView };

interface ListDetailRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: string;
  is_ranked: boolean;
  updated_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  list_items: ListItemRowLike[] | null;
}

/**
 * Resolve exactly one real list by its global slug for /list/[slug]. RLS makes
 * a private list invisible to non-owners, so an unavailable/unauthorized/unknown
 * private list is indistinguishable from a missing one (`not-found`) and never
 * discloses its existence. Owner identity, ordered items, and the viewer's
 * ownership flag are resolved server-side.
 */
export async function getRealListBySlug(slug: string): Promise<RealListResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const viewer = await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lists")
    .select(
      "id, user_id, slug, title, description, visibility, is_ranked, updated_at, profiles!inner(username, display_name, avatar_url), list_items(media_id, position, media_items!inner(slug, title, year, kind, poster_url))",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return { status: "not-found" };

  const row = data as unknown as ListDetailRow;
  if (!row.profiles) return { status: "not-found" };

  const isOwner = viewer?.id === row.user_id;
  const list = toListDetailView(
    row,
    row.profiles,
    row.list_items ?? [],
    isOwner,
  );

  return { status: "ok", list };
}

export type ProfileListsResult =
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; lists: ListSummaryView[] };

/**
 * A profile's real lists, newest first, respecting visibility via RLS: a
 * non-owner viewer sees only the owner's public lists, while the owner sees all
 * of their own. Never inherits mock lists.
 */
export async function getRealListsForUser(
  userId: string,
): Promise<ProfileListsResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .select(
      "id, slug, title, description, visibility, is_ranked, updated_at, list_items(count)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as ListWithCountRow[];
  return {
    status: "ok",
    lists: rows.map((r) => toListSummaryView(r, countOf(r))),
  };
}

// Re-export view-model types so route/UI code imports them from one place.
export type {
  ListDetailView,
  ListDetailItemView,
  ListMembershipView,
  ListOwnerView,
  ListSummaryView,
} from "./list-view-model";
export type { MediaKind };
