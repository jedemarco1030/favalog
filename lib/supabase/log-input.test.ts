import { describe, expect, it } from "vitest";

import {
  MAX_REVIEW_BODY,
  MAX_REVIEW_TITLE,
  deriveDiaryAction,
  isValidRating,
  logVerbLabel,
  validateLogInput,
} from "./log-input";

describe("isValidRating", () => {
  it("accepts absence (null/undefined)", () => {
    expect(isValidRating(null)).toBe(true);
    expect(isValidRating(undefined)).toBe(true);
  });

  it("accepts half-star values from 0.5 to 5", () => {
    for (const r of [0.5, 1, 1.5, 2.5, 4.5, 5]) {
      expect(isValidRating(r)).toBe(true);
    }
  });

  it("rejects 0, out-of-range, and non-half-star values", () => {
    for (const r of [0, -1, 5.5, 6, 4.3, 0.25]) {
      expect(isValidRating(r)).toBe(false);
    }
  });
});

describe("deriveDiaryAction", () => {
  it("uses watch verbs for movies and TV", () => {
    expect(deriveDiaryAction("movie", false)).toBe("watched");
    expect(deriveDiaryAction("movie", true)).toBe("rewatched");
    expect(deriveDiaryAction("tv", false)).toBe("watched");
    expect(deriveDiaryAction("tv", true)).toBe("rewatched");
  });

  it("uses read verbs for books", () => {
    expect(deriveDiaryAction("book", false)).toBe("read");
    expect(deriveDiaryAction("book", true)).toBe("reread");
  });
});

describe("logVerbLabel", () => {
  it("capitalizes the media-appropriate verb", () => {
    expect(logVerbLabel("movie", false)).toBe("Watched");
    expect(logVerbLabel("book", true)).toBe("Reread");
  });
});

describe("validateLogInput", () => {
  const now = new Date("2026-08-06T12:00:00Z");

  it("accepts a minimal valid log and normalizes it", () => {
    const result = validateLogInput({ mediaSlug: "afterglow" }, now);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      mediaSlug: "afterglow",
      loggedAt: null,
      rating: null,
      isRevisit: false,
      reviewTitle: null,
      reviewBody: null,
      containsSpoilers: false,
    });
  });

  it("requires a media slug", () => {
    const result = validateLogInput({ mediaSlug: "   " }, now);
    expect(result.ok).toBe(false);
    expect(result.errors.form).toBeDefined();
  });

  it("rejects an invalid rating", () => {
    const result = validateLogInput(
      { mediaSlug: "afterglow", rating: 4.3 },
      now,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.rating).toBeDefined();
  });

  it("accepts and preserves a valid rating and revisit flag", () => {
    const result = validateLogInput(
      { mediaSlug: "afterglow", rating: 4.5, isRevisit: true },
      now,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.rating).toBe(4.5);
    expect(result.value?.isRevisit).toBe(true);
  });

  it("rejects a future logged date but accepts a past one", () => {
    const future = validateLogInput(
      { mediaSlug: "afterglow", loggedAt: "2030-01-01T00:00:00Z" },
      now,
    );
    expect(future.ok).toBe(false);
    expect(future.errors.loggedAt).toBeDefined();

    const past = validateLogInput(
      { mediaSlug: "afterglow", loggedAt: "2026-01-01T00:00:00Z" },
      now,
    );
    expect(past.ok).toBe(true);
    expect(past.value?.loggedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects an unparseable logged date", () => {
    const result = validateLogInput(
      { mediaSlug: "afterglow", loggedAt: "not-a-date" },
      now,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.loggedAt).toBeDefined();
  });

  it("keeps a non-empty review body and its title/spoiler flag", () => {
    const result = validateLogInput(
      {
        mediaSlug: "afterglow",
        reviewTitle: " Lovely ",
        reviewBody: " Really enjoyed it. ",
        containsSpoilers: true,
      },
      now,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.reviewTitle).toBe("Lovely");
    expect(result.value?.reviewBody).toBe("Really enjoyed it.");
    expect(result.value?.containsSpoilers).toBe(true);
  });

  it("drops an empty review body and its title/spoiler flag", () => {
    const result = validateLogInput(
      {
        mediaSlug: "afterglow",
        reviewTitle: "orphan title",
        reviewBody: "   ",
        containsSpoilers: true,
      },
      now,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.reviewBody).toBeNull();
    expect(result.value?.reviewTitle).toBeNull();
    expect(result.value?.containsSpoilers).toBe(false);
  });

  it("rejects an over-long review body or title", () => {
    const longBody = validateLogInput(
      { mediaSlug: "afterglow", reviewBody: "x".repeat(MAX_REVIEW_BODY + 1) },
      now,
    );
    expect(longBody.ok).toBe(false);
    expect(longBody.errors.reviewBody).toBeDefined();

    const longTitle = validateLogInput(
      {
        mediaSlug: "afterglow",
        reviewBody: "ok",
        reviewTitle: "x".repeat(MAX_REVIEW_TITLE + 1),
      },
      now,
    );
    expect(longTitle.ok).toBe(false);
    expect(longTitle.errors.reviewTitle).toBeDefined();
  });
});
