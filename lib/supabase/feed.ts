import "server-only";

/**
 * Server-only read layer for the following feed.
 *
 * One bounded page of the REAL entertainment activity of the accounts the
 * authenticated viewer currently follows, derived at read time from the
 * authoritative records (`diary_entries`, `reviews`, `follows`) by the
 * SECURITY INVOKER `public.get_following_feed` RPC.
 *
 * Contracts that make this safe and truthful:
 *
 *   - Authorization is NEVER derived from the request: the reader re-validates
 *     the viewer through the auth DAL and the RPC independently re-derives
 *     `auth.uid()` and re-joins `public.follows`, with source RLS still in
 *     force as a second boundary. No viewer id is ever sent.
 *   - The cursor is a POSITION, not a capability. It is validated by the pure
 *     `feed-cursor` module before it is used, and an invalid cursor is a
 *     rejected request — never a silent "start from the beginning".
 *   - Page size is bounded by {@link FEED_MAX_PAGE_SIZE}; `limit + 1` rows are
 *     requested so the end of the feed is detected from real data instead of
 *     being guessed.
 *   - Viewer-specific reads stay out of every shared cache: only the
 *     per-request SSR client is used — no `unstable_cache`, no cross-request
 *     memoization.
 *   - It NEVER falls back to mock activity. An unconfigured environment
 *     reports `unavailable` and a read failure reports `error`, so fabricated
 *     activity can never be presented as a real feed.
 *
 * The Supabase client and the viewer lookup are injectable so the flow is
 * unit-testable without a live database or request context.
 */

import { getCurrentUser } from "@/lib/auth/data";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";
import { classifyFollowingFeedError, type DbError } from "./feed-errors";
import { decodeFeedCursor, encodeFeedCursor } from "./feed-cursor";
import {
  mapFeedRows,
  type FeedActivityRow,
  type FeedActivityView,
} from "./feed-view-model";

/** Default items per feed page. */
export const FEED_PAGE_SIZE = 20;

/**
 * Hard maximum items per page. Deliberately below the RPC's own clamp (50) so
 * the `limit + 1` end-of-feed probe always fits inside it.
 */
export const FEED_MAX_PAGE_SIZE = 25;

/** Items in the Home preview shelf. */
export const FEED_PREVIEW_SIZE = 6;

/** The discriminated result every feed surface renders from. */
export type FeedPageResult =
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "error" }
  | {
      status: "ok";
      items: FeedActivityView[];
      nextCursor: string | null;
      hasMore: boolean;
    };

/** Untrusted page inputs — both are validated/clamped inside the reader. */
export interface FeedPageInput {
  cursor?: string | null;
  limit?: number | null;
}

/** RPC arguments, exactly as the database function declares them. */
export interface FeedRpcArgs {
  p_limit: number;
  p_cursor_created_at: string | null;
  p_cursor_source: string | null;
  p_cursor_id: string | null;
}

/** The narrow port the reader needs (one RPC call). */
export interface FeedRpcClient {
  fetchFeed(
    args: FeedRpcArgs,
  ): Promise<{ data: unknown; error: DbError | null }>;
}

/** Injectable dependencies (all optional; production defaults are used). */
export interface FeedDeps {
  getClient?: () => Promise<FeedRpcClient>;
  getViewer?: () => Promise<{ id: string } | null>;
}

/** Minimal structural view of the Supabase RPC surface we use. */
interface FeedSupabase {
  rpc(
    fn: "get_following_feed",
    args: FeedRpcArgs,
  ): PromiseLike<{ data: unknown; error: DbError | null }>;
}

async function defaultGetClient(): Promise<FeedRpcClient> {
  const supabase = (await createClient()) as unknown as FeedSupabase;
  return {
    async fetchFeed(args) {
      const res = await supabase.rpc("get_following_feed", args);
      return { data: res.data ?? null, error: res.error ?? null };
    },
  };
}

async function defaultGetViewer(): Promise<{ id: string } | null> {
  const user = await getCurrentUser();
  return user ? { id: user.id } : null;
}

/** Clamp an untrusted page size into `1..FEED_MAX_PAGE_SIZE`. */
export function clampFeedLimit(limit: number | null | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return FEED_PAGE_SIZE;
  }
  const whole = Math.floor(limit);
  if (whole < 1) return 1;
  return Math.min(whole, FEED_MAX_PAGE_SIZE);
}

/**
 * One bounded page of the viewer's following feed, newest first.
 *
 * Returns `unavailable` when Supabase is not configured (so a no-env build
 * never crashes), `signed-out` when there is no validated viewer, and `error`
 * for an invalid cursor or a failed read — never a raw database error and
 * never mock activity.
 */
export async function getFollowingFeedPage(
  input: FeedPageInput = {},
  deps: FeedDeps = {},
): Promise<FeedPageResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const getViewer = deps.getViewer ?? defaultGetViewer;
  const viewer = await getViewer();
  if (!viewer) return { status: "signed-out" };

  const rawCursor =
    typeof input.cursor === "string" && input.cursor.trim() !== ""
      ? input.cursor
      : null;
  const cursor = rawCursor === null ? null : decodeFeedCursor(rawCursor);
  // A cursor was supplied but is not a cursor we issued: reject the request
  // rather than silently serving page one over the top of a later page.
  if (rawCursor !== null && cursor === null) return { status: "error" };

  const limit = clampFeedLimit(input.limit);

  const getClient = deps.getClient ?? defaultGetClient;
  const client = await getClient();
  const { data, error } = await client.fetchFeed({
    // One extra row is a reliable "is there another page?" probe.
    p_limit: limit + 1,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_source: cursor?.source ?? null,
    p_cursor_id: cursor?.id ?? null,
  });

  if (error) {
    return classifyFollowingFeedError(error) === "signed-out"
      ? { status: "signed-out" }
      : { status: "error" };
  }

  const rows = Array.isArray(data) ? (data as FeedActivityRow[]) : [];
  const probedMore = rows.length > limit;
  const pageRows = probedMore ? rows.slice(0, limit) : rows;

  // The cursor is built from the last RAW row of the page, not the last mapped
  // item: a dropped malformed row must still advance the seek past itself.
  const last = pageRows[pageRows.length - 1];
  const nextCursor = probedMore
    ? encodeFeedCursor({
        createdAt: last?.created_at ?? null,
        source: last?.source ?? null,
        id: last?.activity_id ?? null,
      })
    : null;

  return {
    status: "ok",
    items: mapFeedRows(pageRows),
    nextCursor,
    // Without a usable cursor we cannot honestly promise another page.
    hasMore: nextCursor !== null,
  };
}

/**
 * The short Home preview of the same real feed. It is the same read with a
 * smaller bound and no cursor, so Home can never disagree with `/feed`.
 */
export async function getFollowingFeedPreview(
  limit: number = FEED_PREVIEW_SIZE,
  deps: FeedDeps = {},
): Promise<FeedPageResult> {
  return getFollowingFeedPage({ limit }, deps);
}
