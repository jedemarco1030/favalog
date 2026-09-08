/**
 * Shared, pure state + parsing contract for the SET-FOLLOW Server Action,
 * used with React's `useActionState`.
 *
 * Kept out of the `"use server"` actions module so both client controls and
 * the action can import these types, and so the parser can be unit-tested
 * without any server imports.
 */

import type { SetFollowInput } from "@/lib/supabase/follow-input";

function booleanField(value: FormDataEntryValue | null): boolean {
  return value === "true";
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Build a {@link SetFollowInput} from submitted form data. Pure and defensive:
 * reads only the target username and desired boolean follow state.
 */
export function parseFollowFormData(formData: FormData): SetFollowInput {
  return {
    username: stringOrNull(formData.get("username")) ?? "",
    isFollow: booleanField(formData.get("isFollow")),
  };
}

export type FollowFormStatus =
  | "idle"
  | "success"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface FollowFormState {
  status: FollowFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Safe, same-origin path for the auth / onboarding cases. */
  redirectTo?: string;
  /**
   * The ACTUAL resulting follow state on success, as returned by the server.
   */
  isFollowing?: boolean;
  /** The target profile username on success. */
  username?: string;
}

export const initialFollowFormState: FollowFormState = { status: "idle" };
