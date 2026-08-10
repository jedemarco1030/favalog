/**
 * Shared, pure state + parsing contract for the title-logging Server Action,
 * used with React's `useActionState`.
 *
 * Kept out of the `"use server"` actions module (which may only export async
 * functions) so both the client dialog and the action can import the types,
 * and so `parseLogFormData` can be unit-tested without any server imports.
 *
 * The parser reads ONLY the fields of {@link LogMediaInput} from the submitted
 * form. It deliberately never reads a user id, media UUID, or any ownership
 * field — ownership is derived server-side from `auth.uid()`; the browser only
 * says WHICH catalog title (by trusted slug) to log and WHAT to record.
 */

import type { LogFieldErrors, LogMediaInput } from "@/lib/supabase/log-input";

export type LogFormStatus =
  | "idle"
  | "invalid"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding"
  | "success";

export interface LogFormState {
  status: LogFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Per-field validation errors keyed by input name. */
  fieldErrors?: LogFieldErrors;
  /** On success, the id of the created diary entry. */
  diaryEntryId?: string;
  /** True when the successful log also created a linked review. */
  createdReview?: boolean;
  /**
   * Safe, same-origin path the client should navigate to for the auth /
   * onboarding cases. Always constructed on the server from validated values.
   */
  redirectTo?: string;
}

export const initialLogFormState: LogFormState = { status: "idle" };

/** A submitted checkbox arrives as its `value` (default "on") when checked. */
function checkboxOn(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Build a {@link LogMediaInput} from submitted form data. Pure and defensive:
 * it coerces the rating to a number (or null), reads only the allowed fields,
 * and leaves authoritative validation/normalization to the server.
 */
export function parseLogFormData(formData: FormData): LogMediaInput {
  const ratingRaw = stringOrNull(formData.get("rating"));
  let rating: number | null = null;
  if (ratingRaw !== null && ratingRaw.trim() !== "") {
    const parsed = Number(ratingRaw);
    rating = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    mediaSlug: stringOrNull(formData.get("mediaSlug")) ?? "",
    loggedAt: stringOrNull(formData.get("loggedAt")),
    rating,
    isRevisit: checkboxOn(formData.get("isRevisit")),
    reviewTitle: stringOrNull(formData.get("reviewTitle")),
    reviewBody: stringOrNull(formData.get("reviewBody")),
    containsSpoilers: checkboxOn(formData.get("containsSpoilers")),
  };
}
