/**
 * Pure, safe mapping of `get_following_feed` RPC errors for the following
 * feed read path.
 *
 * Kept free of any server/Supabase import so it can be unit-tested in
 * isolation and reused by the server-only read layer. Raw database detail is
 * NEVER surfaced to the browser — every branch returns a stable, human-readable
 * string, and the reader turns the classification into one of its discriminated
 * result states.
 */

import type { DbError } from "./log-errors";

export type { DbError } from "./log-errors";

export const GENERIC_FEED_ERROR =
  "We couldn't load the feed just now. Please try again in a moment.";

/** How the reader should treat a failed feed read. */
export type FeedErrorKind = "signed-out" | "invalid-cursor" | "error";

function haystackOf(error: DbError): string {
  return `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
}

/**
 * Classify a feed read failure.
 *
 * The RPC raises `28000` when `auth.uid()` is null (the session expired
 * between render and read) and `22023` for an invalid cursor (a partial cursor
 * or an unknown source). Anything else — including an RLS denial — is an
 * opaque read failure.
 */
export function classifyFollowingFeedError(error: DbError): FeedErrorKind {
  const code = error.code ?? "";
  const haystack = haystackOf(error);

  if (code === "28000" || haystack.includes("authentication required")) {
    return "signed-out";
  }
  if (code === "22023" || haystack.includes("invalid feed cursor")) {
    return "invalid-cursor";
  }
  return "error";
}

/** Map a feed read failure to a safe, user-facing message. */
export function mapFollowingFeedError(error: DbError): string {
  switch (classifyFollowingFeedError(error)) {
    case "signed-out":
      return "Please sign in to see your feed.";
    case "invalid-cursor":
      return "We lost your place in the feed. Please refresh to start again.";
    default:
      return GENERIC_FEED_ERROR;
  }
}
