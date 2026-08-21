/**
 * Pure, safe mapping of Supabase/Postgres RPC errors to user-facing messages
 * for the favorite write path (set_favorite).
 *
 * Kept free of any server/Supabase import so it can be unit-tested in isolation
 * and reused by the server-only data layer. Raw error detail is NEVER surfaced
 * to the browser — every branch returns a stable, human-readable string,
 * consistent with the diary and list write paths.
 */

import type { DbError } from "./log-errors";

export type { DbError } from "./log-errors";

export const GENERIC_SET_FAVORITE_ERROR =
  "We couldn't update your favorites just now. Please try again in a moment.";

const NOT_FOUND_TITLE_ERROR =
  "We couldn't find that title. Please refresh and try again.";

/** Map a `set_favorite` RPC error to a safe, user-facing message. */
export function mapSetFavoriteError(error: DbError): string {
  const code = error.code ?? "";
  const haystack = `${code} ${error.message ?? ""}`.toLowerCase();

  if (code === "28000" || haystack.includes("authentication required")) {
    return "Please sign in to continue.";
  }
  if (code === "P0002" || haystack.includes("unknown media")) {
    return NOT_FOUND_TITLE_ERROR;
  }
  if (code === "22023" || haystack.includes("invalid favorite state")) {
    return "That request wasn't valid. Please try again.";
  }
  if (code === "42501") {
    // RLS / privilege denial — never expose the raw detail.
    return "You don't have permission to do that.";
  }
  return GENERIC_SET_FAVORITE_ERROR;
}
