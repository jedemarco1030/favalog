import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import {
  validateSetFavoriteInput,
  type SetFavoriteInput,
} from "./favorite-input";
import {
  GENERIC_SET_FAVORITE_ERROR,
  mapSetFavoriteError,
} from "./favorite-errors";
import {
  toFavoriteViews,
  type FavoriteRowLike,
  type FavoriteView,
} from "./favorite-view-model";

export { mapSetFavoriteError } from "./favorite-errors";

/**
 * Server-side write + read paths for the persistent favorites shelf.
 *
 * The write mirrors the diary/list write layer: it refuses to run without
 * Supabase configured (a controlled "unavailable" state so no-env builds never
 * crash), independently re-validates the authenticated user AND profile
 * completeness via the server-only auth DAL (never trusting the client),
 * re-validates/normalizes input server-side, delegates the atomic write to the
 * SECURITY INVOKER `set_favorite` RPC (ownership from auth.uid(), RLS in
 * force), treats a missing/malformed RPC success contract as a failure, and
 * maps raw Supabase/Postgres errors to safe messages. Reads are RLS-scoped
 * (favorites are publicly readable) and return serializable view models — never
 * raw rows.
 */

// ---------------------------------------------------------------------------
// Revalidation
// ---------------------------------------------------------------------------

/**
 * Revalidate every surface that reflects a favorite write: the affected title
 * page (by server-returned canonical slug) and the author's own real profile.
 * The username is resolved from the server-side auth DAL — never a client value
 * — so a caller can't trigger revalidation of another user's route.
 */
async function revalidateFavoriteWrite(slug: string): Promise<void> {
  if (slug) revalidatePath(`/title/${slug}`);
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
// set_favorite (write)
// ---------------------------------------------------------------------------

export type SetFavoriteResult =
  | {
      status: "success";
      mediaId: string;
      slug: string;
      /** The ACTUAL resulting state returned by the RPC (never optimistic). */
      isFavorite: boolean;
      /** Resulting shelf position when a favorite; null when removed. */
      position: number | null;
      /** True only when a row was actually inserted/deleted. */
      changed: boolean;
    }
  | { status: "unauthenticated" }
  | { status: "incomplete-profile" }
  | { status: "unavailable" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

interface SetFavoriteRpcResult {
  favorite_id?: string | null;
  media_id?: string;
  slug?: string;
  position?: number | null;
  is_favorite?: boolean;
  changed?: boolean;
}

/** Add or remove the current user's favorite for a trusted catalog title. */
export async function setFavorite(
  input: SetFavoriteInput,
): Promise<SetFavoriteResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const auth = await requireOnboardedUser();
  if (!auth.ok) return { status: auth.status };

  const validation = validateSetFavoriteInput(input);
  if (!validation.ok || !validation.value) {
    return {
      status: "invalid",
      message: validation.message ?? GENERIC_SET_FAVORITE_ERROR,
    };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_favorite", {
    p_media_slug: value.mediaSlug,
    p_is_favorite: value.isFavorite,
  });

  if (error) return { status: "error", message: mapSetFavoriteError(error) };

  const result = (data ?? {}) as SetFavoriteRpcResult;
  const slug = asString(result.slug);
  const mediaId = asString(result.media_id);
  // Defensive success contract: without a real media id AND canonical slug AND
  // an explicit boolean resulting state, the write may not have completed as
  // expected; never report a false success.
  if (
    slug === "" ||
    mediaId === "" ||
    typeof result.is_favorite !== "boolean"
  ) {
    return { status: "error", message: GENERIC_SET_FAVORITE_ERROR };
  }

  await revalidateFavoriteWrite(slug);

  return {
    status: "success",
    mediaId,
    slug,
    isFavorite: result.is_favorite,
    position: typeof result.position === "number" ? result.position : null,
    changed: result.changed === true,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type MyFavoriteStateResult =
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "error" }
  | { status: "ok"; mediaKnown: boolean; isFavorite: boolean };

/**
 * The current viewer's favorite state for a single trusted title slug. Powers
 * the title-page Favorite/Favorited toggle. Owner-scoped by `auth.uid()`; an
 * unknown catalog slug returns `mediaKnown: false` (a controlled state), never
 * an error. A read error fails closed to a safe `error` state.
 */
export async function getMyFavoriteState(
  mediaSlug: string,
): Promise<MyFavoriteStateResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const user = await getCurrentUser();
  if (!user) return { status: "signed-out" };

  const supabase = await createClient();

  const { data: mediaRow, error: mediaError } = await supabase
    .from("media_items")
    .select("id")
    .eq("slug", mediaSlug)
    .maybeSingle();

  if (mediaError) return { status: "error" };
  const mediaId = mediaRow?.id ?? null;
  if (mediaId === null) {
    return { status: "ok", mediaKnown: false, isFavorite: false };
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .maybeSingle();

  if (error) return { status: "error" };

  return { status: "ok", mediaKnown: true, isFavorite: data !== null };
}

export type ProfileFavoritesResult =
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; favorites: FavoriteView[] };

/**
 * A profile's real favorites, ordered by `position`. Favorites are publicly
 * readable (the documented RLS model), so a visitor sees the owner's favorites
 * too. Media rows are resolved and mapped through the existing domain boundary,
 * so real favorites render through the established cross-media UI. Never
 * inherits mock data.
 */
export async function getRealFavoritesForUser(
  userId: string,
): Promise<ProfileFavoritesResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("id, position, media_items!inner (*)")
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as FavoriteRowLike[];
  return { status: "ok", favorites: toFavoriteViews(rows) };
}

// Re-export the view-model types so route/UI code imports them from one place.
export type { FavoriteView } from "./favorite-view-model";
