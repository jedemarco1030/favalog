import type { FeedActivityView } from "@/lib/supabase/feed-view-model";

/**
 * The serializable contract between the `loadMoreFeedAction` Server Action and
 * the client feed list.
 *
 * Kept in its own plain module (no `"use server"`) — exactly like
 * `app/title/[slug]/favorite-form.ts` — so the client list, its tests, and
 * Storybook can import the shape without pulling in a server module.
 */
export type LoadMoreFeedResult =
  | {
      status: "ok";
      items: FeedActivityView[];
      nextCursor: string | null;
      hasMore: boolean;
    }
  /** The viewer's session is gone; the page must be reloaded, not patched. */
  | { status: "signed-out"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

/** The injected "load the next page" action signature. */
export type LoadMoreFeedAction = (
  cursor: string,
) => Promise<LoadMoreFeedResult>;

/** Shown when another page could not be loaded — never a raw database error. */
export const GENERIC_LOAD_MORE_ERROR =
  "We couldn't load more activity. Please try again.";

/** Shown when the session ended between pages. */
export const SIGNED_OUT_LOAD_MORE_ERROR =
  "Your session ended. Please sign in again to keep reading your feed.";

/** Shown when the environment has no Supabase configuration. */
export const UNAVAILABLE_LOAD_MORE_ERROR =
  "The feed isn't available in this environment yet.";
