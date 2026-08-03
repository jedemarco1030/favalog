import { describe, expect, it } from "vitest";
import {
  books,
  getAllMedia,
  getCriticallyAcclaimed,
  getHiddenGems,
  getMediaById,
  getMediaByKind,
  getMediaBySlug,
  getNewAndNoteworthy,
  getPopularBooks,
  getPopularMovies,
  getPopularTV,
  getTrendingMedia,
  mediaItems,
  movies,
  searchTermsFor,
  tvShows,
} from "./media";

describe("getMediaBySlug", () => {
  it("resolves a valid slug to the matching item", () => {
    const item = getMediaBySlug("afterglow");
    expect(item?.id).toBe("m_afterglow");
    expect(item?.title).toBe("Afterglow");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getMediaBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("getMediaById", () => {
  it("resolves a known id", () => {
    expect(getMediaById("b_smallhours")?.slug).toBe("the-small-hours");
  });

  it("returns undefined for an unknown id", () => {
    expect(getMediaById("nope")).toBeUndefined();
  });
});

describe("getMediaByKind", () => {
  it("returns only items of the requested kind", () => {
    const tv = getMediaByKind("tv");
    expect(tv.length).toBe(tvShows.length);
    expect(tv.every((item) => item.kind === "tv")).toBe(true);
  });
});

describe("getAllMedia", () => {
  it("returns every movie, show, and book", () => {
    expect(getAllMedia()).toHaveLength(
      movies.length + tvShows.length + books.length,
    );
    expect(getAllMedia()).toBe(mediaItems);
  });
});

describe("getTrendingMedia", () => {
  it("interleaves movie, tv, and book deterministically", () => {
    const trending = getTrendingMedia(3);
    expect(trending.map((item) => item.kind)).toEqual(["movie", "tv", "book"]);
    expect(trending[0]).toBe(movies[0]);
    expect(trending[1]).toBe(tvShows[0]);
    expect(trending[2]).toBe(books[0]);
  });

  it("honors the limit and is stable across calls", () => {
    expect(getTrendingMedia(5)).toHaveLength(5);
    expect(getTrendingMedia(5)).toEqual(getTrendingMedia(5));
  });
});

describe("popularity selectors", () => {
  it("sorts movies by rating descending and limits", () => {
    const popular = getPopularMovies(3);
    expect(popular).toHaveLength(3);
    expect(popular.every((item) => item.kind === "movie")).toBe(true);
    const ratings = popular.map((m) => m.averageRating ?? 0);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    expect(ratings[0]).toBe(
      Math.max(...movies.map((m) => m.averageRating ?? 0)),
    );
  });

  it("returns the correct kind for TV and books", () => {
    expect(getPopularTV(2).every((item) => item.kind === "tv")).toBe(true);
    expect(getPopularBooks(2).every((item) => item.kind === "book")).toBe(true);
  });
});

describe("getCriticallyAcclaimed", () => {
  it("only returns items rated 4.3 or higher, sorted descending", () => {
    const acclaimed = getCriticallyAcclaimed(10);
    expect(acclaimed.length).toBeGreaterThan(0);
    expect(acclaimed.every((item) => (item.averageRating ?? 0) >= 4.3)).toBe(
      true,
    );
    const ratings = acclaimed.map((item) => item.averageRating ?? 0);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });
});

describe("getNewAndNoteworthy", () => {
  it("orders titles by release year, newest first", () => {
    const recent = getNewAndNoteworthy(6);
    const years = recent.map((item) => item.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });
});

describe("getHiddenGems", () => {
  it("returns the curated titles in their curated order", () => {
    const gems = getHiddenGems();
    expect(gems.map((item) => item.id)).toEqual([
      "m_slowmountain",
      "b_paperbirds",
      "t_undertheeaves",
      "m_arclighthouse",
      "b_theslowdial",
      "t_ridgeandriver",
    ]);
  });
});

describe("searchTermsFor", () => {
  it("includes a movie's director and cast alongside title and genres", () => {
    const terms = searchTermsFor(movies[0]);
    expect(terms).toContain("Afterglow");
    expect(terms).toContain("Drama");
    expect(terms).toContain("Noor Salim");
    expect(terms).toContain("Iris Vale");
  });

  it("includes a show's creators", () => {
    const northlight = getMediaByKind("tv").find(
      (t) => t.slug === "northlight",
    );
    const terms = searchTermsFor(northlight!);
    expect(terms).toContain("Sana Ito");
  });

  it("includes a book's authors and subtitle when present", () => {
    const smallHours = getMediaBySlug("the-small-hours");
    const terms = searchTermsFor(smallHours!);
    expect(terms).toContain("Camille Aro");
    expect(terms).toContain("A Novel");
  });
});
