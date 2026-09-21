"use server";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { setListLike, setReviewLike } from "@/lib/supabase/likes";
import {
  parseLikeFormData,
  type LikeFormState,
} from "@/components/likes/like-form";

/**
 * `"use server"` boundary for the like toggle (reviews and lists).
 *
 * The only Client-callable entry point for liking a target. A thin,
 * authoritative gate in front of the existing `setReviewLike` / `setListLike`
 * write paths — it does not duplicate the RPC call. Treated as a public
 * endpoint, it:
 *
 *   - reads only the target kind, the target UUID, and the DESIRED boolean
 *     state (never a liker id / username / ownership field);
 *   - relies on the write path to re-validate the authenticated user AND a
 *     complete onboarded profile via the server-only auth DAL, and on the RPC's
 *     `auth.uid()` identity + RLS + accessibility check in the database;
 *   - routes a signed-out / expired-session caller through the safe `returnTo`
 *     flow and an incomplete profile to onboarding, with every redirect target
 *     server-built and validated (a client destination is never trusted); and
 *   - returns a stable, serializable {@link LikeFormState} carrying the ACTUAL
 *     server-returned count + viewer bit, never a raw Supabase/Postgres error
 *     and never an optimistic guess.
 */
export async function setLikeAction(
  _prevState: LikeFormState,
  formData: FormData,
): Promise<LikeFormState> {
  const input = parseLikeFormData(formData);

  // The only navigation target we ever build from the request is a validated,
  // same-origin path; a client-supplied destination is never trusted.
  const returnTo = getSafeRedirectPath(input.returnTo, "/");

  const result =
    input.targetType === "list"
      ? await setListLike({ listId: input.targetId, isLiked: input.isLiked })
      : await setReviewLike({
          reviewId: input.targetId,
          isLiked: input.isLiked,
        });

  switch (result.status) {
    case "success":
      return {
        status: "success",
        isLiked: result.isLiked,
        likeCount: result.likeCount,
      };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to like this.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile to like things.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Liking isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}

/** Append a validated `returnTo` query to a base path (omitted for "/"). */
function withReturnTo(base: string, returnTo: string): string {
  if (!returnTo || returnTo === "/") return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}
