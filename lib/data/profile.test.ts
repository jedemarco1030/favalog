import { describe, expect, it } from "vitest";
import { getListsByUser, getReviewsByUser } from "./index";
import { getDiaryEntriesByType } from "./diary";
import {
  getUserProfileStats,
  getUserRecentActivity,
  getUserRecentlyRead,
  getUserRecentlyWatched,
} from "./profile";

const JAMIE = "u_ari";

describe("getUserProfileStats", () => {
  it("derives watched/read counts from the diary, not hardcoded totals", () => {
    const stats = getUserProfileStats(JAMIE);
    expect(stats.moviesWatched).toBe(
      getDiaryEntriesByType("movie", JAMIE).length,
    );
    expect(stats.showsWatched).toBe(getDiaryEntriesByType("tv", JAMIE).length);
    expect(stats.booksRead).toBe(getDiaryEntriesByType("book", JAMIE).length);
  });

  it("derives the review and list totals from their selectors", () => {
    const stats = getUserProfileStats(JAMIE);
    expect(stats.reviews).toBe(getReviewsByUser(JAMIE).length);
    expect(stats.lists).toBe(getListsByUser(JAMIE).length);
  });

  it("averages every rated diary entry to one decimal place", () => {
    const stats = getUserProfileStats(JAMIE);
    // 15 rated entries summing to 63.0 -> 4.2 average.
    expect(stats.averageRating).toBe(4.2);
  });

  it("returns zeroed stats and no average for an unknown user", () => {
    const stats = getUserProfileStats("u_nobody");
    expect(stats).toMatchObject({
      moviesWatched: 0,
      showsWatched: 0,
      booksRead: 0,
      reviews: 0,
      lists: 0,
    });
    expect(stats.averageRating).toBeUndefined();
  });
});

describe("getUserRecentlyWatched", () => {
  it("returns distinct movies and TV, newest first, never books", () => {
    const items = getUserRecentlyWatched(JAMIE);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.kind !== "book")).toBe(true);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(items[0].id).toBe("m_duneparttwo");
  });

  it("respects the limit", () => {
    expect(getUserRecentlyWatched(JAMIE, 3)).toHaveLength(3);
  });
});

describe("getUserRecentlyRead", () => {
  it("returns only books, newest first", () => {
    const items = getUserRecentlyRead(JAMIE);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.kind === "book")).toBe(true);
    expect(items[0].id).toBe("b_northroom");
  });
});

describe("getUserRecentActivity", () => {
  it("returns the user's own activity, newest first, capped at the limit", () => {
    const items = getUserRecentActivity(JAMIE, 4);
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.userId === JAMIE)).toBe(true);
    const times = items.map((item) => item.createdAt);
    expect(times).toEqual([...times].sort((a, b) => (a < b ? 1 : -1)));
  });
});
