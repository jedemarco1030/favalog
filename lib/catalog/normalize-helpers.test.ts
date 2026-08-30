import { describe, expect, it } from "vitest";

import {
  MAX_GENRE_LENGTH,
  MAX_GENRES,
  MAX_PERSON_NAME_LENGTH,
  MAX_YEAR,
  MIN_YEAR,
} from "./config";
import {
  capGenres,
  capList,
  capText,
  cleanText,
  coercePositiveInt,
  coerceRating,
  coerceYear,
} from "./normalize-helpers";

describe("cleanText", () => {
  it("collapses runs of whitespace into single spaces and trims", () => {
    expect(cleanText("  hello   world  ")).toBe("hello world");
    expect(cleanText("a\t\n b\r\nc")).toBe("a b c");
  });

  it("returns '' for null, undefined, and non-string input", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(42)).toBe("");
    expect(cleanText({})).toBe("");
    expect(cleanText([])).toBe("");
  });

  it("returns '' for a whitespace-only string", () => {
    expect(cleanText("   \n\t  ")).toBe("");
  });
});

describe("capText", () => {
  it("returns the cleaned text unchanged when within the cap", () => {
    expect(capText("  hello  world ", 100)).toBe("hello world");
  });

  it("caps the length to maxLength", () => {
    expect(capText("abcdefghij", 5)).toBe("abcde");
  });

  it("trims after truncation so a cut never leaves a trailing space", () => {
    // "hello world" sliced to 6 chars is "hello " -> trimmed to "hello".
    expect(capText("hello world", 6)).toBe("hello");
  });

  it("returns '' for non-string input", () => {
    expect(capText(null, 10)).toBe("");
    expect(capText(undefined, 10)).toBe("");
    expect(capText(123, 10)).toBe("");
  });
});

describe("capList", () => {
  it("drops blank / non-string elements", () => {
    expect(capList(["a", "", "   ", "b", null, undefined, 5], 10)).toEqual([
      "a",
      "b",
    ]);
  });

  it("caps each element's length", () => {
    expect(capList(["abcdef"], 10, 3)).toEqual(["abc"]);
  });

  it("caps the number of items", () => {
    expect(capList(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });

  it("de-dupes case-insensitively while preserving first-seen order", () => {
    expect(capList(["Alpha", "beta", "ALPHA", "Beta", "gamma"], 10)).toEqual([
      "Alpha",
      "beta",
      "gamma",
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(capList("not an array", 10)).toEqual([]);
    expect(capList(null, 10)).toEqual([]);
    expect(capList(undefined, 10)).toEqual([]);
    expect(capList({}, 10)).toEqual([]);
  });

  it("defaults element length cap to MAX_PERSON_NAME_LENGTH", () => {
    const long = "x".repeat(MAX_PERSON_NAME_LENGTH + 50);
    const [result] = capList([long], 10);
    expect(result).toHaveLength(MAX_PERSON_NAME_LENGTH);
  });
});

describe("capGenres", () => {
  it("caps the number of genres at MAX_GENRES", () => {
    const many = Array.from({ length: MAX_GENRES + 5 }, (_, i) => `genre${i}`);
    expect(capGenres(many)).toHaveLength(MAX_GENRES);
  });

  it("caps each genre length at MAX_GENRE_LENGTH", () => {
    const long = "g".repeat(MAX_GENRE_LENGTH + 10);
    const [result] = capGenres([long]);
    expect(result).toHaveLength(MAX_GENRE_LENGTH);
  });

  it("returns [] for non-array input", () => {
    expect(capGenres(null)).toEqual([]);
  });
});

describe("coerceYear", () => {
  it("accepts a finite number, truncating any fraction", () => {
    expect(coerceYear(1999)).toBe(1999);
    expect(coerceYear(2000.9)).toBe(2000);
  });

  it("accepts a 'YYYY' string", () => {
    expect(coerceYear("2010")).toBe(2010);
  });

  it("accepts a 'YYYY-MM-DD' string", () => {
    expect(coerceYear("2015-07-04")).toBe(2015);
  });

  it("returns undefined for out-of-range years", () => {
    expect(coerceYear(MIN_YEAR - 1)).toBeUndefined();
    expect(coerceYear(MAX_YEAR + 1)).toBeUndefined();
    expect(coerceYear("1700")).toBeUndefined();
    expect(coerceYear("3000")).toBeUndefined();
  });

  it("accepts the inclusive range boundaries", () => {
    expect(coerceYear(MIN_YEAR)).toBe(MIN_YEAR);
    expect(coerceYear(MAX_YEAR)).toBe(MAX_YEAR);
  });

  it("returns undefined for non-numeric / missing input", () => {
    expect(coerceYear("not-a-year")).toBeUndefined();
    expect(coerceYear(undefined)).toBeUndefined();
    expect(coerceYear(null)).toBeUndefined();
    expect(coerceYear(Number.NaN)).toBeUndefined();
    expect(coerceYear(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe("coerceRating", () => {
  it("rescales a provider rating onto the 0-5 scale, rounded to 2 decimals", () => {
    // 8/10 * 5 = 4
    expect(coerceRating(8, 10)).toBe(4);
    // 7.5/10 * 5 = 3.75
    expect(coerceRating(7.5, 10)).toBe(3.75);
    // 8.3/10 * 5 = 4.15
    expect(coerceRating(8.3, 10)).toBe(4.15);
  });

  it("clamps to a maximum of 5", () => {
    expect(coerceRating(12, 10)).toBe(5);
    expect(coerceRating(10, 10)).toBe(5);
  });

  it("returns undefined for 0, negative, NaN, and non-number values", () => {
    expect(coerceRating(0, 10)).toBeUndefined();
    expect(coerceRating(-3, 10)).toBeUndefined();
    expect(coerceRating(Number.NaN, 10)).toBeUndefined();
    expect(coerceRating("8" as unknown as number, 10)).toBeUndefined();
    expect(coerceRating(undefined, 10)).toBeUndefined();
    expect(coerceRating(null, 10)).toBeUndefined();
  });

  it("returns undefined when maxScale is non-positive", () => {
    expect(coerceRating(5, 0)).toBeUndefined();
    expect(coerceRating(5, -10)).toBeUndefined();
  });
});

describe("coercePositiveInt", () => {
  it("returns a positive integer from a number, truncating fractions", () => {
    expect(coercePositiveInt(110)).toBe(110);
    expect(coercePositiveInt(110.9)).toBe(110);
  });

  it("parses a positive integer from a numeric string", () => {
    expect(coercePositiveInt("42")).toBe(42);
    expect(coercePositiveInt("42 pages")).toBe(42);
  });

  it("returns 0 for zero, negatives, NaN, and unparseable input", () => {
    expect(coercePositiveInt(0)).toBe(0);
    expect(coercePositiveInt(-5)).toBe(0);
    expect(coercePositiveInt(Number.NaN)).toBe(0);
    expect(coercePositiveInt("abc")).toBe(0);
    expect(coercePositiveInt(null)).toBe(0);
    expect(coercePositiveInt(undefined)).toBe(0);
    expect(coercePositiveInt({})).toBe(0);
  });
});
