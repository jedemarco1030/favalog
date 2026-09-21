import "server-only";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import {
  validateSetLikeInput,
  type SetLikeInput,
  type LikeTargetType,
} from "./like-input";
import { mapSetLikeError, GENERIC_SET_LIKE_ERROR } from "./like-errors";

/**
 * Server-side write + read paths for persistent review and list likes.
 *
 * The writes mirror the favorite/follow write layers: each one refuses to run
 * without Supabase configured (a controlled "unavailable" state so no-env
 * builds never crash), independently re-validates the authenticated user AND a
 * complete onboarded profile via the server-only auth DAL (never trusting the
 * client), re-validates/normalizes input server-side, delegates the atomic,
 * idempotent write to a SECURITY INVOKER RPC (identity from `auth.uid()`, RLS
 * in force, accessibility enforced in the RPC), treats a missing/malformed RPC
 * result as a failure, and maps raw Supabase/Postgres errors to safe messages.
 *
 * The reads are batched SECURITY DEFINER aggregations that return ONLY a count
 * plus the caller's own viewer bit — never liker identities. An inaccessible
 * target is simply omitted from the result (no disclosure); callers treat a
 * missing id as `{ likeCount: 0, viewerHasLiked: false }`.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** The like aggregate for one target, as shown to a viewer. */
export interface LikeState {
  likeCount: number;
  viewerHasLiked: boolean;
}

export type SetLikeResult =
  | { status: "success"; isLiked: boolean; likeCount: number; changed: boolean }
  | { status: "unauthenticated" }
  | { status: "incomplete-profile" }
  | { status: "unavailable" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

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

interface SetLikeRpcResult {
  like_count?: number;
  viewer_has_liked?: boolean;
  changed?: boolean;
}

/**
 * Shared write path for both target kinds. Resolves the correct RPC + id
 * parameter name from the validated target type, so review and list likes share
 * one authoritative, security-consistent code path.
 */
async function setLike(input: SetLikeInput): Promise<SetLikeResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const auth = await requireOnboardedUser();
  if (!auth.ok) return { status: auth.status };

  const validation = validateSetLikeInput(input);
  if (!validation.ok || !validation.value) {
    return {
      status: "invalid",
      message: validation.message ?? GENERIC_SET_LIKE_ERROR,
    };
  }
  const value = validation.value;

  const supabase = await createClient();

  // Two explicit calls rather than a computed name/arg pair: each RPC has a
  // distinct required id parameter, so branching keeps the call fully typed
  // against the generated function signatures.
  const { data, error } =
    value.targetType === "review"
      ? await supabase.rpc("set_review_like", {
          p_review_id: value.targetId,
          p_is_liked: value.isLiked,
        })
      : await supabase.rpc("set_list_like", {
          p_list_id: value.targetId,
          p_is_liked: value.isLiked,
        });

  if (error) return { status: "error", message: mapSetLikeError(error) };

  const result = (data ?? {}) as SetLikeRpcResult;
  // Defensive success contract: the RPC always returns a numeric count and a
  // boolean viewer bit. Anything else means the write did not complete as
  // expected, so never report a false success.
  if (
    typeof result.like_count !== "number" ||
    typeof result.viewer_has_liked !== "boolean"
  ) {
    return { status: "error", message: GENERIC_SET_LIKE_ERROR };
  }

  return {
    status: "success",
    isLiked: result.viewer_has_liked,
    likeCount: result.like_count,
    changed: result.changed === true,
  };
}

/** Like/unlike an accessible real review as the current user. */
export function setReviewLike(input: {
  reviewId: string;
  isLiked: boolean;
}): Promise<SetLikeResult> {
  return setLike({
    targetType: "review",
    targetId: input.reviewId,
    isLiked: input.isLiked,
  });
}

/** Like/unlike an accessible real list as the current user. */
export function setListLike(input: {
  listId: string;
  isLiked: boolean;
}): Promise<SetLikeResult> {
  return setLike({
    targetType: "list",
    targetId: input.listId,
    isLiked: input.isLiked,
  });
}

// ---------------------------------------------------------------------------
// Batched reads
// ---------------------------------------------------------------------------

interface LikeStateRow {
  like_count: number | null;
  viewer_has_liked: boolean | null;
}

interface ReviewLikeStateRow extends LikeStateRow {
  review_id: string;
}

interface ListLikeStateRow extends LikeStateRow {
  list_id: string;
}

/** Normalize one aggregate row to a safe {@link LikeState}. */
function toLikeState(row: LikeStateRow): LikeState {
  return {
    likeCount: typeof row.like_count === "number" ? row.like_count : 0,
    viewerHasLiked: row.viewer_has_liked === true,
  };
}

/** Distinct, non-empty UUIDs preserving nothing but membership. */
function cleanIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && id.trim() !== "") seen.add(id.trim());
  }
  return [...seen];
}

/**
 * Batched like states for reviews, keyed by review id. Ids that are missing
 * from the result (nonexistent) are simply absent; callers default them to a
 * zero/false state. Returns an empty map when Supabase is unavailable or a read
 * fails, a controlled degraded state rather than a crash.
 */
export async function getReviewLikeStates(
  reviewIds: readonly string[],
): Promise<Map<string, LikeState>> {
  const out = new Map<string, LikeState>();
  if (!isSupabaseConfigured()) return out;
  const ids = cleanIds(reviewIds);
  if (ids.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_review_like_states", {
    p_review_ids: ids,
  });
  if (error || !data) return out;

  for (const row of data as unknown as ReviewLikeStateRow[]) {
    if (typeof row.review_id === "string") {
      out.set(row.review_id, toLikeState(row));
    }
  }
  return out;
}

/**
 * Batched like states for lists, keyed by list id. Inaccessible lists (private
 * or followers-only the viewer doesn't follow) are OMITTED by the database
 * function, so they never appear here — no disclosure. Returns an empty map
 * when Supabase is unavailable or a read fails.
 */
export async function getListLikeStates(
  listIds: readonly string[],
): Promise<Map<string, LikeState>> {
  const out = new Map<string, LikeState>();
  if (!isSupabaseConfigured()) return out;
  const ids = cleanIds(listIds);
  if (ids.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_list_like_states", {
    p_list_ids: ids,
  });
  if (error || !data) return out;

  for (const row of data as unknown as ListLikeStateRow[]) {
    if (typeof row.list_id === "string") {
      out.set(row.list_id, toLikeState(row));
    }
  }
  return out;
}

/** A zero/false like state for a target absent from a batched read. */
export const EMPTY_LIKE_STATE: LikeState = {
  likeCount: 0,
  viewerHasLiked: false,
};

export type { LikeTargetType };
