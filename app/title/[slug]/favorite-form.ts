/**
 * Shared, pure state + parsing contract for the SET-FAVORITE Server Action,
 * used with React's `useActionState`.
 *
 * Kept out of the `"use server"` actions module (which may only export async
 * functions) so both the client favorite control and the action can import
 * these types, and so the parser can be unit-tested without any server imports.
 *
 * The parser reads ONLY allow-listed fields. It never reads a user id, media
 * UUID, username, position, or ownership field: ownership is re-derived
 * server-side from `auth.uid()`, the media is resolved server-side from a
 * trusted slug, and positions are assigned by the database. The browser only
 * says WHICH title (by trusted slug) and the DESIRED next state (a boolean).
 */

import type { SetFavoriteInput } from "@/lib/supabase/favorite-input";

/** A submitted desired-state flag arrives as the string "true"/"false". */
function booleanField(value: FormDataEntryValue | null): boolean {
  return value === "true";
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Build a {@link SetFavoriteInput} from submitted form data. Pure and
 * defensive: reads only the trusted media slug and the desired boolean state,
 * leaving authoritative validation/normalization to the server.
 */
export function parseFavoriteFormData(formData: FormData): SetFavoriteInput {
  return {
    mediaSlug: stringOrNull(formData.get("mediaSlug")) ?? "",
    isFavorite: booleanField(formData.get("isFavorite")),
  };
}

export type FavoriteFormStatus =
  | "idle"
  | "success"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface FavoriteFormState {
  status: FavoriteFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Safe, same-origin path for the auth / onboarding cases. */
  redirectTo?: string;
  /**
   * The ACTUAL resulting favorite state on success, as returned by the server
   * — the control renders this, never an optimistic guess that could contradict
   * the write.
   */
  isFavorite?: boolean;
  /** The affected title's canonical slug on success. */
  slug?: string;
}

export const initialFavoriteFormState: FavoriteFormState = { status: "idle" };
