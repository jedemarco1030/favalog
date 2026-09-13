import { describe, expect, it } from "vitest";

import {
  GENERIC_FEED_ERROR,
  classifyFollowingFeedError,
  mapFollowingFeedError,
} from "./feed-errors";

describe("classifyFollowingFeedError", () => {
  it("treats the unauthenticated RPC error as signed-out", () => {
    expect(classifyFollowingFeedError({ code: "28000" })).toBe("signed-out");
    expect(
      classifyFollowingFeedError({ message: "authentication required" }),
    ).toBe("signed-out");
  });

  it("treats an invalid cursor as its own kind", () => {
    expect(classifyFollowingFeedError({ code: "22023" })).toBe(
      "invalid-cursor",
    );
    expect(
      classifyFollowingFeedError({ message: "invalid feed cursor source: x" }),
    ).toBe("invalid-cursor");
  });

  it("treats anything else — including an RLS denial — as an opaque error", () => {
    expect(classifyFollowingFeedError({ code: "42501" })).toBe("error");
    expect(classifyFollowingFeedError({})).toBe("error");
    expect(
      classifyFollowingFeedError({
        code: "PGRST202",
        message: 'relation "public.follows" does not exist',
      }),
    ).toBe("error");
  });
});

describe("mapFollowingFeedError", () => {
  it("returns a safe message per classification", () => {
    expect(mapFollowingFeedError({ code: "28000" })).toBe(
      "Please sign in to see your feed.",
    );
    expect(mapFollowingFeedError({ code: "22023" })).toBe(
      "We lost your place in the feed. Please refresh to start again.",
    );
    expect(mapFollowingFeedError({ code: "42501" })).toBe(GENERIC_FEED_ERROR);
  });

  it("never leaks raw database detail", () => {
    const message = mapFollowingFeedError({
      code: "XX000",
      message: 'permission denied for table "diary_entries"',
    });
    expect(message).toBe(GENERIC_FEED_ERROR);
    expect(message).not.toContain("diary_entries");
  });
});
