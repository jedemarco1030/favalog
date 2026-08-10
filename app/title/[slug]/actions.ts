"use server";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { logMedia } from "@/lib/supabase/log";
import { parseLogFormData, type LogFormState } from "./log-form";

/**
 * `"use server"` boundary for the title-logging interaction.
 *
 * This is the ONLY Client-callable entry point for logging a title. It is a
 * thin, authoritative gate in front of the existing `logMedia(...)` write path
 * — it does not duplicate the RPC call. Treated as a public endpoint, it:
 *
 *   - reads only {@link import("@/lib/supabase/log-input").LogMediaInput}
 *     fields from the form (never a user id / media UUID / ownership field);
 *   - re-validates the authenticated user via the server-only auth DAL and
 *     requires a COMPLETE onboarded profile before any write;
 *   - routes a signed-out or expired-session caller through the existing safe
 *     `returnTo` flow, and an incomplete profile to onboarding, preserving the
 *     intended title destination (all redirect targets are server-built and
 *     validated — a client-supplied destination is never trusted); and
 *   - returns a stable, serializable {@link LogFormState} for `useActionState`,
 *     never a raw Supabase/Postgres error.
 */
export async function logTitleAction(
  _prevState: LogFormState,
  formData: FormData,
): Promise<LogFormState> {
  const input = parseLogFormData(formData);

  // The only navigation target we ever build from the request. The slug comes
  // from the page's hidden field, but we still validate it as a safe path.
  const titlePath = getSafeRedirectPath(`/title/${input.mediaSlug}`, "/");

  const user = await getCurrentUser();
  if (!user) {
    const returnTo = getSafeRedirectPath(formData.get("returnTo"), titlePath);
    return {
      status: "unauthenticated",
      message: "Please sign in to log a title.",
      redirectTo: withReturnTo("/auth/sign-in", returnTo),
    };
  }

  const profile = await getCurrentProfile();
  if (!isProfileComplete(profile)) {
    return {
      status: "onboarding",
      message: "Finish setting up your profile to start logging.",
      redirectTo: withReturnTo("/onboarding", titlePath),
    };
  }

  const result = await logMedia(input);
  switch (result.status) {
    case "success":
      return {
        status: "success",
        diaryEntryId: result.diaryEntryId,
        createdReview: result.reviewId !== null,
      };
    case "invalid":
      return {
        status: "invalid",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: result.errors,
      };
    case "unauthenticated":
      // The session expired between the page render and the submit.
      return {
        status: "unauthenticated",
        message: "Your session expired. Please sign in again.",
        redirectTo: withReturnTo("/auth/sign-in", titlePath),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Logging isn't available in this environment yet.",
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
