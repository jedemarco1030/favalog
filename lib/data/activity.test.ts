import { describe, expect, it } from "vitest";
import {
  getRatingDistribution,
  getRelatedMedia,
  getReviewById,
  getReviewsForMedia,
  recommendationShelves,
} from "./activity";
import { getMediaById } from "./media";

describe("getReviewsForMedia", () => {
  it("returns a media item's reviews newest first", () => {
    const reviews = getReviewsForMedia("t_harbourlines");
    expect(reviews.length).toBeGreaterThan(1);
    expect(reviews.every((r) => r.mediaId === "t_harbourlines")).toBe(true);
    const dates = reviews.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort((a, b) => (a < b ? 1 : -1)));
  });

  it("returns an empty array for media with no reviews", () => {
    expect(getReviewsForMedia("m_paperlantern")).toEqual([]);
  });
});

describe("getReviewById", () => {
  it("resolves a known review id", () => {
    expect(getReviewById("r_1")?.mediaId).toBe("m_afterglow");
  });

  it("returns undefined for an unknown id", () => {
    expect(getReviewById("r_999")).toBeUndefined();
  });
});

describe("getRelatedMedia", () => {
  it("leads with the curated shelf for a seeded media item", () => {
    const shelf = recommendationShelves.find(
      (s) => s.seedMediaId === "m_duneparttwo",
    )!;
    const related = getRelatedMedia("m_duneparttwo", 6);
    expect(related.slice(0, shelf.mediaIds.length).map((m) => m.id)).toEqual(
      shelf.mediaIds,
    );
  });

  it("never includes the seed item itself and respects the limit", () => {
    const related = getRelatedMedia("m_paperlantern", 4);
    expect(related).toHaveLength(4);
    expect(related.some((m) => m.id === "m_paperlantern")).toBe(false);
  });

  it("is deterministic across calls", () => {
    expect(getRelatedMedia("m_paperlantern", 5).map((m) => m.id)).toEqual(
      getRelatedMedia("m_paperlantern", 5).map((m) => m.id),
    );
  });
});

describe("getRatingDistribution", () => {
  it("returns undefined for an unknown media id", () => {
    expect(getRatingDistribution("nope")).toBeUndefined();
  });

  it("produces buckets that sum exactly to the total count", () => {
    const dist = getRatingDistribution("m_afterglow")!;
    const item = getMediaById("m_afterglow")!;
    expect(dist.average).toBe(item.averageRating);
    expect(dist.buckets.reduce((a, b) => a + b, 0)).toBe(dist.count);
  });

  it("is deterministic for a given media id", () => {
    expect(getRatingDistribution("b_bright_index")).toEqual(
      getRatingDistribution("b_bright_index"),
    );
  });
});
