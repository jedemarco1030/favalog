import { describe, expect, it, vi } from "vitest";

import {
  EXPLORE_RESULT_SELECTED_EVENT,
  EXPLORE_SEARCH_EVENT,
  buildResultSelectedEvent,
  buildSearchOutcomeEvent,
  rankBucket,
  resultCountBucket,
  trackResultSelected,
  trackSearchOutcome,
  type TrackFn,
} from "@/lib/analytics/search-analytics";

/** Keys that must NEVER be sent to product analytics (high-cardinality/PII). */
const FORBIDDEN_PROPERTY_KEYS = [
  "query",
  "q",
  "queryText",
  "title",
  "slug",
  "mediaTitle",
  "mediaSlug",
  "requestId",
  "correlationId",
  "userId",
  "user",
  "username",
  "email",
  "session",
  "ip",
  "resultCount",
  "rank",
  "index",
];

describe("resultCountBucket", () => {
  it("buckets counts into coarse, fixed ranges", () => {
    expect(resultCountBucket(0)).toBe("0");
    expect(resultCountBucket(1)).toBe("1-3");
    expect(resultCountBucket(3)).toBe("1-3");
    expect(resultCountBucket(4)).toBe("4-10");
    expect(resultCountBucket(10)).toBe("4-10");
    expect(resultCountBucket(11)).toBe("11+");
    expect(resultCountBucket(999)).toBe("11+");
  });

  it("treats negative or non-finite counts as zero", () => {
    expect(resultCountBucket(-5)).toBe("0");
    expect(resultCountBucket(Number.NaN)).toBe("0");
  });
});

describe("rankBucket", () => {
  it("buckets a zero-based index into coarse 1-based rank bands", () => {
    expect(rankBucket(0)).toBe("1");
    expect(rankBucket(1)).toBe("2-3");
    expect(rankBucket(2)).toBe("2-3");
    expect(rankBucket(3)).toBe("4-10");
    expect(rankBucket(9)).toBe("4-10");
    expect(rankBucket(10)).toBe("11+");
  });

  it("returns 'unknown' for an invalid index", () => {
    expect(rankBucket(-1)).toBe("unknown");
    expect(rankBucket(Number.NaN)).toBe("unknown");
  });
});

describe("buildSearchOutcomeEvent", () => {
  it("uses the fixed event name and only coarse, allow-listed properties", () => {
    const event = buildSearchOutcomeEvent({
      mode: "hybrid",
      filter: "movie",
      zeroResult: false,
      resultCount: 7,
    });

    expect(event.name).toBe(EXPLORE_SEARCH_EVENT);
    expect(event.properties).toEqual({
      mode: "hybrid",
      filter: "movie",
      zeroResult: false,
      resultCountBucket: "4-10",
    });

    for (const forbidden of FORBIDDEN_PROPERTY_KEYS) {
      expect(Object.keys(event.properties)).not.toContain(forbidden);
    }
  });
});

describe("buildResultSelectedEvent", () => {
  it("uses the fixed event name and only coarse, allow-listed properties", () => {
    const event = buildResultSelectedEvent({
      mode: "keyword",
      filter: "all",
      resultKind: "book",
      index: 4,
    });

    expect(event.name).toBe(EXPLORE_RESULT_SELECTED_EVENT);
    expect(event.properties).toEqual({
      mode: "keyword",
      filter: "all",
      resultKind: "book",
      rankBucket: "4-10",
    });

    for (const forbidden of FORBIDDEN_PROPERTY_KEYS) {
      expect(Object.keys(event.properties)).not.toContain(forbidden);
    }
  });
});

describe("trackSearchOutcome / trackResultSelected", () => {
  it("emits the search-outcome event through the injected track", () => {
    const track = vi.fn<TrackFn>();
    trackSearchOutcome(
      {
        mode: "keyword_fallback",
        filter: "tv",
        zeroResult: true,
        resultCount: 0,
      },
      track,
    );

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(EXPLORE_SEARCH_EVENT, {
      mode: "keyword_fallback",
      filter: "tv",
      zeroResult: true,
      resultCountBucket: "0",
    });
  });

  it("emits the result-selected event through the injected track", () => {
    const track = vi.fn<TrackFn>();
    trackResultSelected(
      { mode: "hybrid", filter: "all", resultKind: "movie", index: 0 },
      track,
    );

    expect(track).toHaveBeenCalledWith(EXPLORE_RESULT_SELECTED_EVENT, {
      mode: "hybrid",
      filter: "all",
      resultKind: "movie",
      rankBucket: "1",
    });
  });

  it("never throws when the analytics transport fails or is unavailable", () => {
    const throwing: TrackFn = () => {
      throw new Error("analytics blocked");
    };

    expect(() =>
      trackSearchOutcome(
        { mode: "hybrid", filter: "all", zeroResult: false, resultCount: 5 },
        throwing,
      ),
    ).not.toThrow();

    expect(() =>
      trackResultSelected(
        { mode: "hybrid", filter: "all", resultKind: "tv", index: 2 },
        throwing,
      ),
    ).not.toThrow();
  });
});
