import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FEED_MAX_PAGE_SIZE,
  FEED_PAGE_SIZE,
  clampFeedLimit,
  getFollowingFeedPage,
  getFollowingFeedPreview,
  type FeedDeps,
  type FeedRpcArgs,
} from "./feed";
import { encodeFeedCursor } from "./feed-cursor";
import type { FeedActivityRow } from "./feed-view-model";

const UUID_PREFIX = "00000000-0000-4000-8000-0000000000";

function idFor(i: number): string {
  return `${UUID_PREFIX}${String(i).padStart(2, "0")}`;
}

function row(i: number, overrides: Partial<FeedActivityRow> = {}) {
  return {
    source: "diary",
    activity_id: idFor(i),
    created_at: `2026-09-13T17:47:00.00000${i % 10}+00:00`,
    logged_at: null,
    actor_username: "mira",
    actor_display_name: "Mira Chen",
    actor_avatar_url: null,
    media_slug: `slug-${i}`,
    media_title: `Title ${i}`,
    media_year: 2024,
    media_kind: "movie",
    media_poster_url: null,
    rating: null,
    is_revisit: false,
    review_id: null,
    review_title: null,
    review_body: null,
    contains_spoilers: null,
    ...overrides,
  } satisfies FeedActivityRow;
}

/** A fake RPC client that records the exact args it was called with. */
function makeDeps(
  result: { data: unknown; error: { code?: string } | null },
  viewer: { id: string } | null = { id: "viewer-1" },
): FeedDeps & { calls: FeedRpcArgs[] } {
  const calls: FeedRpcArgs[] = [];
  return {
    calls,
    getViewer: async () => viewer,
    getClient: async () => ({
      fetchFeed: async (args: FeedRpcArgs) => {
        calls.push(args);
        return result;
      },
    }),
  };
}

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_KEY;
  }
});

describe("clampFeedLimit", () => {
  it("defaults a missing or non-finite limit", () => {
    expect(clampFeedLimit(undefined)).toBe(FEED_PAGE_SIZE);
    expect(clampFeedLimit(null)).toBe(FEED_PAGE_SIZE);
    expect(clampFeedLimit(Number.NaN)).toBe(FEED_PAGE_SIZE);
  });

  it("bounds the requested page size", () => {
    expect(clampFeedLimit(0)).toBe(1);
    expect(clampFeedLimit(-10)).toBe(1);
    expect(clampFeedLimit(6)).toBe(6);
    expect(clampFeedLimit(6.9)).toBe(6);
    expect(clampFeedLimit(10_000)).toBe(FEED_MAX_PAGE_SIZE);
  });
});

describe("getFollowingFeedPage", () => {
  it("reports unavailable when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const deps = makeDeps({ data: [], error: null });
    await expect(getFollowingFeedPage({}, deps)).resolves.toEqual({
      status: "unavailable",
    });
    expect(deps.calls).toHaveLength(0);
  });

  it("reports signed-out without a validated viewer and never reads", async () => {
    const deps = makeDeps({ data: [], error: null }, null);
    await expect(getFollowingFeedPage({}, deps)).resolves.toEqual({
      status: "signed-out",
    });
    expect(deps.calls).toHaveLength(0);
  });

  it("requests limit + 1 rows and sends no cursor on the first page", async () => {
    const deps = makeDeps({ data: [row(1)], error: null });
    const result = await getFollowingFeedPage({ limit: 3 }, deps);

    expect(deps.calls[0]).toEqual({
      p_limit: 4,
      p_cursor_created_at: null,
      p_cursor_source: null,
      p_cursor_id: null,
    });
    expect(result).toMatchObject({
      status: "ok",
      nextCursor: null,
      hasMore: false,
    });
  });

  it("never sends a viewer id to the database", async () => {
    const deps = makeDeps({ data: [], error: null });
    await getFollowingFeedPage({}, deps);
    expect(Object.keys(deps.calls[0] ?? {}).sort()).toEqual([
      "p_cursor_created_at",
      "p_cursor_id",
      "p_cursor_source",
      "p_limit",
    ]);
  });

  it("trims the probe row and issues a cursor for the next page", async () => {
    const rows = [row(1), row(2), row(3), row(4)];
    const deps = makeDeps({ data: rows, error: null });
    const result = await getFollowingFeedPage({ limit: 3 }, deps);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.items.map((i) => i.key)).toEqual([
      `diary:${idFor(1)}`,
      `diary:${idFor(2)}`,
      `diary:${idFor(3)}`,
    ]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(
      encodeFeedCursor({
        createdAt: rows[2].created_at,
        source: "diary",
        id: idFor(3),
      }),
    );
  });

  it("forwards a valid cursor as the keyset seek", async () => {
    const cursor = encodeFeedCursor({
      createdAt: "2026-09-13T17:47:00.123456+00:00",
      source: "review",
      id: idFor(9),
    });
    const deps = makeDeps({ data: [], error: null });
    await getFollowingFeedPage({ cursor, limit: 2 }, deps);

    expect(deps.calls[0]).toEqual({
      p_limit: 3,
      p_cursor_created_at: "2026-09-13T17:47:00.123456+00:00",
      p_cursor_source: "review",
      p_cursor_id: idFor(9),
    });
  });

  it("rejects an invalid cursor instead of silently serving page one", async () => {
    const deps = makeDeps({ data: [row(1)], error: null });
    await expect(
      getFollowingFeedPage({ cursor: "v9:nope:diary:bad" }, deps),
    ).resolves.toEqual({ status: "error" });
    expect(deps.calls).toHaveLength(0);
  });

  it("treats a blank cursor as no cursor", async () => {
    const deps = makeDeps({ data: [], error: null });
    const result = await getFollowingFeedPage({ cursor: "   " }, deps);
    expect(result.status).toBe("ok");
    expect(deps.calls[0]?.p_cursor_created_at).toBeNull();
  });

  it("maps the RPC's unauthenticated error to signed-out", async () => {
    const deps = makeDeps({ data: null, error: { code: "28000" } });
    await expect(getFollowingFeedPage({}, deps)).resolves.toEqual({
      status: "signed-out",
    });
  });

  it("maps any other read failure to a safe error state", async () => {
    for (const code of ["22023", "42501", "XX000"]) {
      const deps = makeDeps({ data: null, error: { code } });
      await expect(getFollowingFeedPage({}, deps)).resolves.toEqual({
        status: "error",
      });
    }
  });

  it("treats a non-array payload as an empty page", async () => {
    const deps = makeDeps({ data: null, error: null });
    await expect(getFollowingFeedPage({}, deps)).resolves.toEqual({
      status: "ok",
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("drops a malformed row but still advances the seek past it", async () => {
    const rows = [row(1), row(2, { media_kind: "podcast" }), row(3)];
    const deps = makeDeps({ data: rows, error: null });
    const result = await getFollowingFeedPage({ limit: 2 }, deps);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.items.map((i) => i.key)).toEqual([`diary:${idFor(1)}`]);
    expect(result.nextCursor).toBe(
      encodeFeedCursor({
        createdAt: rows[1].created_at,
        source: "diary",
        id: idFor(2),
      }),
    );
    expect(result.hasMore).toBe(true);
  });

  it("does not promise another page when no usable cursor can be built", async () => {
    // The last row OF THE PAGE carries an unusable id, so no seek position
    // can be issued even though the probe row proved more rows exist.
    const rows = [row(1), row(2, { activity_id: "not-a-uuid" }), row(3)];
    const deps = makeDeps({ data: rows, error: null });
    const result = await getFollowingFeedPage({ limit: 2 }, deps);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });
});

describe("getFollowingFeedPreview", () => {
  it("reads the same feed with a small bound and no cursor", async () => {
    const deps = makeDeps({ data: [row(1)], error: null });
    const result = await getFollowingFeedPreview(4, deps);

    expect(deps.calls[0]).toEqual({
      p_limit: 5,
      p_cursor_created_at: null,
      p_cursor_source: null,
      p_cursor_id: null,
    });
    expect(result.status).toBe("ok");
  });

  it("bounds an absurd preview size", async () => {
    const deps = makeDeps({ data: [], error: null });
    await getFollowingFeedPreview(1_000, deps);
    expect(deps.calls[0]?.p_limit).toBe(FEED_MAX_PAGE_SIZE + 1);
  });

  it("propagates the unavailable state without reading", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const deps = makeDeps({ data: [], error: null });
    await expect(getFollowingFeedPreview(4, deps)).resolves.toEqual({
      status: "unavailable",
    });
    expect(deps.calls).toHaveLength(0);
  });
});
