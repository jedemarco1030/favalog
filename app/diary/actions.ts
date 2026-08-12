"use server";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { deleteDiaryEntry, updateDiaryEntry } from "@/lib/supabase/log";
import type { LogFormState } from "@/app/title/[slug]/log-form";
import {
  parseDeleteFormData,
  parseEditFormData,
  type DeleteFormState,
} from "./diary-form";

/**
 * `"use server"` boundaries for editing and deleting an existing diary entry.
 *
 * These are the only Client-callable entry points for the edit/delete
 * interactions and are shared by the `/diary` timeline and the `/title/[slug]`
 * personal-state controls. Each is a thin, authoritative gate in front of the
 * existing `updateDiaryEntry` / `deleteDiaryEntry` write paths — it does not
 * duplicate the RPC call. Treated as public endpoints, they:
 *
 *   - read only the allow-listed edit/delete fields (never a user id, media
 *     UUID, username, or any ownership field);
 *   - re-validate the authenticated user via the server-only auth DAL and
 *     require a COMPLETE onboarded profile before any write;
 *   - route a signed-out / expired-session caller through the existing safe
 *     `returnTo` flow, and an incomplete profile to onboarding — all redirect
 *     targets are server-built and validated (a client-supplied destination is
 *     never trusted); and
 *   - return a stable, serializable state for `useActionState`, never a raw
 *     Supabase/Postgres error.
 */

/** Append a validated `returnTo` query to a base path (omitted for "/"). */
function withReturnTo(base: string, returnTo: string): string {
  if (!returnTo || returnTo === "/") return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Resolve a safe navigation target for the auth/onboarding cases. */
function safeReturnTo(formData: FormData): string {
  return getSafeRedirectPath(formData.get("returnTo"), "/diary");
}

export async function editDiaryEntryAction(
  _prevState: LogFormState,
  formData: FormData,
): Promise<LogFormState> {
  const input = parseEditFormData(formData);
  const returnTo = safeReturnTo(formData);

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "unauthenticated",
      message: "Please sign in to edit your entry.",
      redirectTo: withReturnTo("/auth/sign-in", returnTo),
    };
  }

  const profile = await getCurrentProfile();
  if (!isProfileComplete(profile)) {
    return {
      status: "onboarding",
      message: "Finish setting up your profile first.",
      redirectTo: withReturnTo("/onboarding", returnTo),
    };
  }

  const result = await updateDiaryEntry(input);
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
      return {
        status: "unauthenticated",
        message: "Your session expired. Please sign in again.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Editing isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}

export async function deleteDiaryEntryAction(
  _prevState: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const { diaryEntryId } = parseDeleteFormData(formData);
  const returnTo = safeReturnTo(formData);

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "unauthenticated",
      message: "Please sign in to delete your entry.",
      redirectTo: withReturnTo("/auth/sign-in", returnTo),
    };
  }

  const profile = await getCurrentProfile();
  if (!isProfileComplete(profile)) {
    return {
      status: "unauthenticated",
      message: "Finish setting up your profile first.",
      redirectTo: withReturnTo("/onboarding", returnTo),
    };
  }

  const result = await deleteDiaryEntry(diaryEntryId);
  switch (result.status) {
    case "success":
      return { status: "success" };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Your session expired. Please sign in again.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Deleting isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}
