/**
 * Shared, pure state + parsing contracts for the diary EDIT and DELETE Server
 * Actions, used with React's `useActionState`.
 *
 * Kept out of the `"use server"` actions module (which may only export async
 * functions) so both the client dialogs and the actions can import the types,
 * and so the parsers can be unit-tested without any server imports.
 *
 * Like the create-form parser, these read ONLY allow-listed fields. They never
 * read a user id or any ownership field: ownership is re-derived server-side
 * from `auth.uid()`; the browser only says WHICH diary entry (by id) to edit or
 * delete and WHAT the new values are.
 */

import type { EditDiaryInput } from "@/lib/supabase/log-input";

/** A submitted checkbox arrives as its `value` (default "on") when checked. */
function checkboxOn(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Build an {@link EditDiaryInput} from submitted form data. Pure and
 * defensive: it coerces the rating to a number (or null) and reads only the
 * allowed fields, leaving authoritative validation/normalization to the server.
 */
export function parseEditFormData(formData: FormData): EditDiaryInput {
  const ratingRaw = stringOrNull(formData.get("rating"));
  let rating: number | null = null;
  if (ratingRaw !== null && ratingRaw.trim() !== "") {
    const parsed = Number(ratingRaw);
    rating = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    diaryEntryId: stringOrNull(formData.get("diaryEntryId")) ?? "",
    loggedAt: stringOrNull(formData.get("loggedAt")),
    rating,
    isRevisit: checkboxOn(formData.get("isRevisit")),
    reviewTitle: stringOrNull(formData.get("reviewTitle")),
    reviewBody: stringOrNull(formData.get("reviewBody")),
    containsSpoilers: checkboxOn(formData.get("containsSpoilers")),
  };
}

/** Read the diary-entry id from a delete submission (allow-listed field only). */
export function parseDeleteFormData(formData: FormData): {
  diaryEntryId: string;
} {
  return {
    diaryEntryId: stringOrNull(formData.get("diaryEntryId")) ?? "",
  };
}

export type DeleteFormStatus =
  "idle" | "error" | "unavailable" | "unauthenticated" | "success";

export interface DeleteFormState {
  status: DeleteFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /**
   * Safe, same-origin path the client should navigate to for the auth case.
   * Always constructed on the server from validated values.
   */
  redirectTo?: string;
}

export const initialDeleteFormState: DeleteFormState = { status: "idle" };
