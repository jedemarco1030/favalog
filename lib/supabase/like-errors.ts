/**
 * Pure, safe mapping of Supabase/Postgres RPC errors to user-facing messages
 * for the like write path (`set_review_like` / `set_list_like`).
 *
 * Kept free of any server/Supabase imports so it can be unit-tested in
 * isolation and reused by the server-only data layer. Raw error detail is NEVER
 * surfaced to the browser — every branch returns a stable, human-readable
 * string. Critically, an inaccessible/nonexistent target and a genuinely
 * missing one map to the SAME message, so a bare id can never be used to probe
 * for the existence of a private list.
 */

import type { DbError } from "./log-errors";

export type { DbError } from "./log-errors";

export const GENERIC_SET_LIKE_ERROR =
  "We couldn't update this like right now. Please try again in a moment.";

/**
 * Uniform "target is not available to you" message. Deliberately identical for
 * a nonexistent target and an inaccessible (private / not-followed) one so the
 * response never discloses which case applied.
 */
export const UNAVAILABLE_TARGET_ERROR = "This item is no longer available.";

export const SESSION_EXPIRED_ERROR =
  "Your session expired. Please sign in again.";

/**
 * Map a raw DB error from a set-like RPC to a safe message.
 *
 * - `28000` (authentication required): the session lapsed between render and
 *   submit — surface a neutral "sign in again" message.
 * - `P0002` (no accessible target): uniform unavailable message (no disclosure).
 * - anything else (including `22023` malformed input, which validation should
 *   already have caught): the generic retry message.
 */
export function mapSetLikeError(error: DbError | null | undefined): string {
  if (!error) return GENERIC_SET_LIKE_ERROR;

  switch (error.code) {
    case "28000":
      return SESSION_EXPIRED_ERROR;
    case "P0002":
      return UNAVAILABLE_TARGET_ERROR;
    default:
      return GENERIC_SET_LIKE_ERROR;
  }
}
