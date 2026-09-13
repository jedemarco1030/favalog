import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pagination Server Action is a public endpoint, so it must authenticate
 * INDEPENDENTLY and must never treat the cursor as a capability. These tests
 * prove it re-validates the viewer through the auth DAL before it reads, that
 * it does not read at all without one, and that every failure mode crosses
 * back as a safe message rather than a raw database error.
 */

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth/data", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const getFollowingFeedPage = vi.fn();
vi.mock("@/lib/supabase/feed", () => ({
  getFollowingFeedPage: (...args: unknown[]) => getFollowingFeedPage(...args),
}));

import { loadMoreFeedAction } from "@/app/feed/actions";
import {
  GENERIC_LOAD_MORE_ERROR,
  SIGNED_OUT_LOAD_MORE_ERROR,
  UNAVAILABLE_LOAD_MORE_ERROR,
} from "@/app/feed/feed-page-state";

describe("loadMoreFeedAction", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getFollowingFeedPage.mockReset();
  });

  it("refuses to read at all without a validated viewer", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await loadMoreFeedAction("v1:cursor");

    expect(result).toEqual({
      status: "signed-out",
      message: SIGNED_OUT_LOAD_MORE_ERROR,
    });
    // The cursor granted nothing: no read was even attempted.
    expect(getFollowingFeedPage).not.toHaveBeenCalled();
  });

  it("forwards the cursor as a position only and returns the page", async () => {
    getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    getFollowingFeedPage.mockResolvedValue({
      status: "ok",
      items: [],
      nextCursor: "v1:next",
      hasMore: true,
    });

    const result = await loadMoreFeedAction("v1:cursor");

    // No viewer id is passed: authorization stays with auth.uid() + RLS.
    expect(getFollowingFeedPage).toHaveBeenCalledWith({ cursor: "v1:cursor" });
    expect(result).toEqual({
      status: "ok",
      items: [],
      nextCursor: "v1:next",
      hasMore: true,
    });
  });

  it("maps a rejected cursor / failed read to a safe retryable message", async () => {
    getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    getFollowingFeedPage.mockResolvedValue({ status: "error" });

    expect(await loadMoreFeedAction("not-a-cursor")).toEqual({
      status: "error",
      message: GENERIC_LOAD_MORE_ERROR,
    });
  });

  it("reports an expired session and an unconfigured environment distinctly", async () => {
    getCurrentUser.mockResolvedValue({ id: "viewer-1" });

    getFollowingFeedPage.mockResolvedValue({ status: "signed-out" });
    expect(await loadMoreFeedAction("v1:cursor")).toEqual({
      status: "signed-out",
      message: SIGNED_OUT_LOAD_MORE_ERROR,
    });

    getFollowingFeedPage.mockResolvedValue({ status: "unavailable" });
    expect(await loadMoreFeedAction("v1:cursor")).toEqual({
      status: "unavailable",
      message: UNAVAILABLE_LOAD_MORE_ERROR,
    });
  });
});
