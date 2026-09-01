import { describe, expect, it } from "vitest";
import {
  BROWSE_PAGE_SIZE,
  BROWSE_SORTS,
  DEFAULT_BROWSE_SORT,
  MAX_BROWSE_PAGE,
  MAX_GENRE_LENGTH,
  normalizeGenreKey,
  orderColumnsForSort,
  parseBrowsePage,
  parseBrowseSort,
  parseGenreParam,
} from "./query";

describe("parseBrowseSort", () => {
  it("accepts every allow-listed sort", () => {
    for (const sort of BROWSE_SORTS) {
      expect(parseBrowseSort(sort)).toBe(sort);
    }
  });

  it("resets unknown / malformed values to the default", () => {
    expect(parseBrowseSort("popularity")).toBe(DEFAULT_BROWSE_SORT);
    expect(parseBrowseSort("")).toBe(DEFAULT_BROWSE_SORT);
    expect(parseBrowseSort(undefined)).toBe(DEFAULT_BROWSE_SORT);
    expect(parseBrowseSort(42)).toBe(DEFAULT_BROWSE_SORT);
    expect(parseBrowseSort({})).toBe(DEFAULT_BROWSE_SORT);
  });

  it("uses the first value when the parameter repeats", () => {
    expect(parseBrowseSort(["title_asc", "newest"])).toBe("title_asc");
    expect(parseBrowseSort(["bogus", "newest"])).toBe(DEFAULT_BROWSE_SORT);
  });
});

describe("parseBrowsePage", () => {
  it("defaults to 1 for absent / non-numeric input", () => {
    expect(parseBrowsePage(undefined)).toBe(1);
    expect(parseBrowsePage("abc")).toBe(1);
    expect(parseBrowsePage("")).toBe(1);
    expect(parseBrowsePage({})).toBe(1);
    expect(parseBrowsePage(NaN)).toBe(1);
  });

  it("clamps zero and negatives up to 1", () => {
    expect(parseBrowsePage("0")).toBe(1);
    expect(parseBrowsePage("-5")).toBe(1);
    expect(parseBrowsePage(-1)).toBe(1);
  });

  it("clamps absurdly large pages to the ceiling", () => {
    expect(parseBrowsePage("999999")).toBe(MAX_BROWSE_PAGE);
    expect(parseBrowsePage(MAX_BROWSE_PAGE + 10)).toBe(MAX_BROWSE_PAGE);
  });

  it("floors fractional pages and parses numeric strings", () => {
    expect(parseBrowsePage("3")).toBe(3);
    expect(parseBrowsePage(4.9)).toBe(4);
    expect(parseBrowsePage(["2", "7"])).toBe(2);
  });
});

describe("parseGenreParam", () => {
  it("returns a trimmed non-empty string", () => {
    expect(parseGenreParam("Drama")).toBe("Drama");
    expect(parseGenreParam("  Science Fiction  ")).toBe("Science Fiction");
    expect(parseGenreParam(["Comedy", "Drama"])).toBe("Comedy");
  });

  it("returns null for blank / non-string / over-long values", () => {
    expect(parseGenreParam("")).toBeNull();
    expect(parseGenreParam("   ")).toBeNull();
    expect(parseGenreParam(undefined)).toBeNull();
    expect(parseGenreParam(123)).toBeNull();
    expect(parseGenreParam("x".repeat(MAX_GENRE_LENGTH + 1))).toBeNull();
  });
});

describe("normalizeGenreKey", () => {
  it("lower-cases and trims for case/whitespace-insensitive comparison", () => {
    expect(normalizeGenreKey("  Sci-Fi ")).toBe("sci-fi");
    expect(normalizeGenreKey("DRAMA")).toBe("drama");
  });
});

describe("orderColumnsForSort", () => {
  it("always ends with a unique id tie-breaker for a stable total order", () => {
    for (const sort of BROWSE_SORTS) {
      const plan = orderColumnsForSort(sort);
      expect(plan.length).toBeGreaterThanOrEqual(2);
      expect(plan[plan.length - 1]?.column).toBe("id");
    }
  });

  it("maps each sort to the correct primary column + direction", () => {
    expect(orderColumnsForSort("recently_added")[0]).toMatchObject({
      column: "created_at",
      ascending: false,
    });
    expect(orderColumnsForSort("highest_rated")[0]).toMatchObject({
      column: "average_rating",
      ascending: false,
      nullsFirst: false,
    });
    expect(orderColumnsForSort("newest")[0]).toMatchObject({
      column: "year",
      ascending: false,
    });
    expect(orderColumnsForSort("oldest")[0]).toMatchObject({
      column: "year",
      ascending: true,
    });
    expect(orderColumnsForSort("title_asc")[0]).toMatchObject({
      column: "title",
      ascending: true,
    });
  });

  it("pushes nulls last only for the nullable rating column", () => {
    expect(orderColumnsForSort("highest_rated")[0]?.nullsFirst).toBe(false);
    expect(orderColumnsForSort("newest")[0]?.nullsFirst).toBeUndefined();
  });
});

describe("constants", () => {
  it("expose a bounded, constant page size", () => {
    expect(BROWSE_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(BROWSE_PAGE_SIZE)).toBe(true);
  });
});
