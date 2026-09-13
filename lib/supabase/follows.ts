import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import { validateSetFollowInput, type SetFollowInput } from "./follow-input";
import { GENERIC_SET_FOLLOW_ERROR, mapSetFollowError } from "./follow-errors";

export { mapSetFollowError } from "./follow-errors";

/**
 * Server-side write + read paths for the persistent follow lifecycle.
 *
 * Write path:
 *   - refuses without Supabase configured (controlled unavailable state);
 *   - independently re-validates authenticated user and profile completeness;
 *   - validates input server-side;
 *   - calls SECURITY INVOKER `set_follow` RPC (ownership from auth.uid(), RLS in force);
 *   - maps database errors to safe user-facing messages;
 *   - revalidates affected profiles and list pages.
 *
 * Read path:
 *   - reads true follower/following counts directly from database;
 *   - determines viewer follow state;
 *   - never fabricates counts or false relationships on query failure.
 */

// ---------------------------------------------------------------------------
// Revalidation
// ---------------------------------------------------------------------------

async function revalidateFollowWrite(targetUsername: string): Promise<void> {
  if (targetUsername) revalidatePath(`/profile/${targetUsername}`);
  const profile = await getCurrentProfile();
  if (profile) revalidatePath(`/profile/${profile.username}`);
  revalidatePath("/lists");
  // Following is what the feed is derived from: both the dedicated feed and
  // the Home preview must be re-rendered, so the client Router Cache cannot
  // replay a followed account's activity after an unfollow (or miss a new
  // follow's activity) on browser-back or a prefetch.
  revalidatePath("/feed");
  revalidatePath("/");
}

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
// set_follow (write)
// ---------------------------------------------------------------------------

export type SetFollowResult =
  | {
      status: "success";
      targetUsername: string;
      targetUserId: string;
      /** The ACTUAL resulting state returned by the RPC (never optimistic). */
      isFollowing: boolean;
      /** True only when a row was actually inserted/deleted. */
      changed: boolean;
    }
  | { status: "unauthenticated" }
  | { status: "incomplete-profile" }
  | { status: "unavailable" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

interface SetFollowRpcResult {
  target_username?: string;
  target_user_id?: string;
  is_following?: boolean;
  changed?: boolean;
}

/** Set the current user's follow state for a target profile. */
export async function setFollow(
  input: SetFollowInput,
): Promise<SetFollowResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const auth = await requireOnboardedUser();
  if (!auth.ok) return { status: auth.status };

  const validation = validateSetFollowInput(input);
  if (!validation.ok || !validation.value) {
    return {
      status: "invalid",
      message: validation.message ?? "Please provide a valid username.",
    };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_follow", {
    p_target_username: value.username,
    p_is_follow: value.isFollow,
  });

  if (error) return { status: "error", message: mapSetFollowError(error) };

  const result = (data ?? {}) as SetFollowRpcResult;
  const targetUsername = asString(result.target_username);
  const targetUserId = asString(result.target_user_id);

  if (
    targetUsername === "" ||
    targetUserId === "" ||
    typeof result.is_following !== "boolean"
  ) {
    return { status: "error", message: GENERIC_SET_FOLLOW_ERROR };
  }

  await revalidateFollowWrite(targetUsername);

  return {
    status: "success",
    targetUsername,
    targetUserId,
    isFollowing: result.is_following,
    changed: result.changed === true,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * How many accounts the CURRENT viewer follows.
 *
 * The feed needs to tell two very different truths apart: "you follow nobody"
 * and "the people you follow haven't logged anything yet". Both produce an
 * empty page, so the distinction has to be read separately. Returns `null`
 * when it cannot be determined (unconfigured, signed out, or a failed read) —
 * never a fabricated zero.
 */
export async function getMyFollowingCount(): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", user.id);

  if (error || typeof count !== "number") return null;
  return count;
}

export interface ProfileSocialCounts {
  followerCount: number;
  followingCount: number;
}

export type ViewerSocialState =
  | { kind: "signed-out" }
  | { kind: "owner" }
  | { kind: "viewer"; isFollowing: boolean };

export type ProfileSocialStateResult =
  | { status: "unavailable" }
  | { status: "error" }
  | {
      status: "ok";
      counts: ProfileSocialCounts;
      viewerState: ViewerSocialState;
    };

/**
 * Read the social state for a profile: actual follower/following counts
 * and the viewer's follow relationship.
 */
export async function getProfileSocial(
  targetProfileId: string,
  targetUsername: string,
  viewerId?: string | null,
): Promise<ProfileSocialStateResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const supabase = await createClient();

  // Query follower count (people following targetProfileId)
  const { count: followerCount, error: followerErr } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", targetProfileId);

  if (followerErr || typeof followerCount !== "number") {
    return { status: "error" };
  }

  // Query following count (people targetProfileId is following)
  const { count: followingCount, error: followingErr } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", targetProfileId);

  if (followingErr || typeof followingCount !== "number") {
    return { status: "error" };
  }

  let viewerState: ViewerSocialState;
  if (!viewerId) {
    viewerState = { kind: "signed-out" };
  } else if (viewerId === targetProfileId) {
    viewerState = { kind: "owner" };
  } else {
    const { data: relationshipRow, error: relErr } = await supabase
      .from("follows")
      .select("created_at")
      .eq("follower_id", viewerId)
      .eq("following_id", targetProfileId)
      .maybeSingle();

    if (relErr) {
      return { status: "error" };
    }

    viewerState = {
      kind: "viewer",
      isFollowing: relationshipRow !== null,
    };
  }

  return {
    status: "ok",
    counts: {
      followerCount,
      followingCount,
    },
    viewerState,
  };
}
