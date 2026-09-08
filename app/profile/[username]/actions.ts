"use server";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { setFollow } from "@/lib/supabase/follows";
import { parseFollowFormData, type FollowFormState } from "./follow-form";

/** Append a validated `returnTo` query to a base path (omitted for "/"). */
function withReturnTo(base: string, returnTo: string): string {
  if (!returnTo || returnTo === "/") return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * `"use server"` boundary for following/unfollowing a profile.
 *
 * Treated as a public endpoint, it:
 *   - reads only the target username and the DESIRED boolean follow state;
 *   - re-validates the authenticated user and a complete profile;
 *   - routes signed-out or incomplete-profile callers through the safe returnTo flow;
 *   - returns a stable, serializable {@link FollowFormState}.
 */
export async function setFollowAction(
  _prevState: FollowFormState,
  formData: FormData,
): Promise<FollowFormState> {
  const input = parseFollowFormData(formData);

  const profilePath = getSafeRedirectPath(`/profile/${input.username}`, "/");
  const returnTo = getSafeRedirectPath(formData.get("returnTo"), profilePath);

  const result = await setFollow(input);
  switch (result.status) {
    case "success":
      return {
        status: "success",
        isFollowing: result.isFollowing,
        username: result.targetUsername,
      };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to follow profiles.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile to follow others.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Following isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}
