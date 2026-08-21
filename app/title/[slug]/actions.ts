"use server";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { logMedia } from "@/lib/supabase/log";
import { setFavorite } from "@/lib/supabase/favorites";
import { parseLogFormData, type LogFormState } from "./log-form";
import { parseFavoriteFormData, type FavoriteFormState } from "./favorite-form";

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

/**
 * `"use server"` boundary for the title favorite toggle.
 *
 * The only Client-callable entry point for favoriting a title. A thin,
 * authoritative gate in front of the existing `setFavorite(...)` write path —
 * it does not duplicate the RPC call. Treated as a public endpoint, it:
 *
 *   - reads only the trusted media slug and the DESIRED boolean state (never a
 *     user id / media UUID / username / position / ownership field);
 *   - relies on the write path to re-validate the authenticated user AND a
 *     complete onboarded profile via the server-only auth DAL, and on RLS +
 *     `auth.uid()` ownership in the database;
 *   - routes a signed-out / expired-session caller through the safe `returnTo`
 *     flow and an incomplete profile to onboarding, with every redirect target
 *     server-built and validated (a client destination is never trusted); and
 *   - returns a stable, serializable {@link FavoriteFormState} carrying the
 *     ACTUAL server-returned resulting state, never a raw Supabase/Postgres
 *     error and never an optimistic guess.
 */
export async function setFavoriteAction(
  _prevState: FavoriteFormState,
  formData: FormData,
): Promise<FavoriteFormState> {
  const input = parseFavoriteFormData(formData);

  // The only navigation targets we ever build from the request. The slug comes
  // from the page's hidden field, but we still validate it as a safe path.
  const titlePath = getSafeRedirectPath(`/title/${input.mediaSlug}`, "/");
  const returnTo = getSafeRedirectPath(formData.get("returnTo"), titlePath);

  const result = await setFavorite(input);
  switch (result.status) {
    case "success":
      return {
        status: "success",
        isFavorite: result.isFavorite,
        slug: result.slug,
      };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to update your favorites.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile to save favorites.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Favoriting isn't available in this environment yet.",
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
