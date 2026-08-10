import { describe, expect, it } from "vitest";

import {
  deriveProfileStats,
  effectiveReviewRating,
  recentTitlesOfKinds,
  type ProfileDiaryEntry,
} from "./profile-view-model";
import type { Book, MediaItem, Movie, TVShow } from "@/lib/types";

function movie(id: string, slug = id): Movie {
  return {
    id,
    slug,
    kind: "movie",
    title: `Movie ${id}`,
    synopsis: "",
    year: 2026,
    posterUrl: "",
    genres: [],
    runtimeMinutes: 100,
    director: "",
    cast: [],
  };
}
function tv(id: string): TVShow {
  return {
    id,
    slug: id,
    kind: "tv",
    title: `Show ${id}`,
    synopsis: "",
    year: 2026,
    posterUrl: "",
    genres: [],
    seasons: 1,
    episodes: 8,
    creators: [],
    status: "ongoing",
  };
}
function book(id: string): Book {
  return {
    id,
    slug: id,
    kind: "book",
    title: `Book ${id}`,
    synopsis: "",
    year: 2026,
    posterUrl: "",
    genres: [],
    authors: [],
    pageCount: 300,
  };
}

function entry(media: MediaItem, rating: number | null): ProfileDiaryEntry {
  return { mediaId: media.id, kind: media.kind, rating, media };
}

describe("deriveProfileStats", () => {
  it("counts distinct titles per kind (a revisit doesn't inflate the count)", () => {
    const m = movie("m1");
    const stats = deriveProfileStats(
      [entry(m, 4), entry(m, 5), entry(tv("t1"), null), entry(book("b1"), 3)],
      0,
    );
    expect(stats.moviesWatched).toBe(1);
    expect(stats.tvWatched).toBe(1);
    expect(stats.booksRead).toBe(1);
  });

  it("averages only the rated entries", () => {
    const stats = deriveProfileStats(
      [entry(movie("m1"), 4), entry(movie("m2"), 5), entry(movie("m3"), null)],
      0,
    );
    expect(stats.averageRating).toBe(4.5);
  });

  it("reports a null average when nothing is rated", () => {
    const stats = deriveProfileStats([entry(movie("m1"), null)], 0);
    expect(stats.averageRating).toBeNull();
  });

  it("passes the review count straight through", () => {
    expect(deriveProfileStats([], 7).reviews).toBe(7);
  });
});

describe("effectiveReviewRating", () => {
  it("prefers the linked diary entry's rating over the review's null", () => {
    expect(effectiveReviewRating(null, 4.5)).toBe(4.5);
  });

  it("falls back to a standalone review's own rating", () => {
    expect(effectiveReviewRating(3, null)).toBe(3);
  });

  it("is undefined when genuinely unrated", () => {
    expect(effectiveReviewRating(null, null)).toBeUndefined();
    expect(effectiveReviewRating(undefined, undefined)).toBeUndefined();
  });
});

describe("recentTitlesOfKinds", () => {
  it("keeps order, de-duplicates titles, and caps at the limit", () => {
    const m1 = movie("m1");
    const t1 = tv("t1");
    const result = recentTitlesOfKinds(
      [
        entry(m1, 4),
        entry(t1, 4),
        entry(m1, 5), // duplicate title — skipped
        entry(book("b1"), 4), // wrong kind — skipped
      ],
      ["movie", "tv"],
      5,
    );
    expect(result.map((r) => r.id)).toEqual(["m1", "t1"]);
  });

  it("respects the limit", () => {
    const result = recentTitlesOfKinds(
      [entry(book("b1"), 4), entry(book("b2"), 4), entry(book("b3"), 4)],
      ["book"],
      2,
    );
    expect(result).toHaveLength(2);
  });
});
