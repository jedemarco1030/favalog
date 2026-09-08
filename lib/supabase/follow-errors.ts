/**
 * Pure, safe mapping of Supabase/Postgres RPC errors to user-facing messages
 * for the follow write path (set_follow).
 *
 * Kept free of any server/Supabase imports so it can be unit-tested in isolation
 * and reused by the server-only data layer. Raw error detail is NEVER surfaced
 * to the browser — every branch returns a stable, human-readable string.
 */

import type { DbError } from "./log-errors";

export type { DbError } from "./log-errors";

export const GENERIC_SET_FOLLOW_ERROR =
  "We couldn't update this follow right now. Please try again in a moment.";

const NOT_FOUND_PROFILE_ERROR =
  "We couldn't find that profile. Please refresh and try again.";

/** Map a `set_follow` RPC error to a safe, user-facing message. */
export function mapSetFollowError(error: DbError): string {
  const code = error.code ?? "";
  const haystack = `${code} ${error.message ?? ""}`.toLowerCase();

  if (code === "28000" || haystack.includes("authentication required")) {
    return "Please sign in to continue.";
  }
  if (haystack.includes("cannot follow self")) {
    return "You cannot follow your own profile.";
  }
  if (code === "P0002" || haystack.includes("unknown profile")) {
    return NOT_FOUND_PROFILE_ERROR;
  }
  if (
    code === "22023" ||
    haystack.includes("invalid follow state") ||
    haystack.includes("invalid username")
  ) {
    return "That request wasn't valid. Please try again.";
  }
  if (code === "42501") {
    // RLS / privilege denial — never expose the raw detail.
    return "You don't have permission to do that.";
  }
  return GENERIC_SET_FOLLOW_ERROR;
}
