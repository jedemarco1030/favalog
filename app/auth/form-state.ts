/**
 * Shared state contract for the auth/onboarding Server Actions used with
 * React's `useActionState`.
 *
 * Kept in its own module (not the `"use server"` actions file) because a
 * `"use server"` module may only export async functions — types and constants
 * live here so both the client forms and the actions can import them.
 *
 * Nothing secret is ever placed in `values`: only non-sensitive fields (email,
 * username, display name, bio, location) are echoed back so a person does not
 * have to retype them after a validation error. Passwords are never echoed.
 */

export type AuthFormStatus =
  "idle" | "error" | "success" | "confirmation-pending";

export interface AuthFormState {
  status: AuthFormStatus;
  /** Banner-level message (error, success, or informational). */
  message?: string;
  /** Per-field, consumer-friendly validation errors keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Non-sensitive submitted values, echoed back to refill the form. */
  values?: Record<string, string>;
}

/** The starting state for every auth form. */
export const initialAuthFormState: AuthFormState = { status: "idle" };
