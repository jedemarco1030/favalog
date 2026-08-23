import { describe, expect, it } from "vitest";

import { MAX_QUERY_LENGTH } from "@/lib/search/config";
import {
  kindFilterToKind,
  normalizeQuery,
  parseKindFilter,
  validateQuery,
} from "@/lib/search/query";

describe("normalizeQuery", () => {
  it("collapses internal whitespace runs and trims the ends", () => {
    expect(normalizeQuery("  hello   world  ")).toBe("hello world");
    expect(normalizeQuery("line\n\tbreaks")).toBe("line breaks");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeQuery("   \n\t ")).toBe("");
  });
});

describe("validateQuery", () => {
  it("rejects non-string inputs as not_a_string", () => {
    for (const value of [null, undefined, 42, ["a"], {}]) {
      const result = validateQuery(value);
      expect(result).toEqual({ ok: false, reason: "not_a_string" });
    }
  });

  it("rejects an empty or whitespace-only query as empty", () => {
    expect(validateQuery("")).toEqual({ ok: false, reason: "empty" });
    expect(validateQuery("   \t ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects a query longer than MAX_QUERY_LENGTH as too_long", () => {
    const raw = "a".repeat(MAX_QUERY_LENGTH + 1);
    expect(validateQuery(raw)).toEqual({ ok: false, reason: "too_long" });
  });

  it("accepts a query exactly at MAX_QUERY_LENGTH", () => {
    const raw = "a".repeat(MAX_QUERY_LENGTH);
    expect(validateQuery(raw)).toEqual({ ok: true, query: raw });
  });

  it("trims and normalizes an accepted query", () => {
    expect(validateQuery("  desert   epic  ")).toEqual({
      ok: true,
      query: "desert epic",
    });
  });
});

describe("parseKindFilter", () => {
  it("passes each allow-listed value through unchanged", () => {
    for (const value of ["all", "movie", "tv", "book"] as const) {
      expect(parseKindFilter(value)).toBe(value);
    }
  });

  it("collapses unknown, undefined, or object inputs to all", () => {
    expect(parseKindFilter("unknown")).toBe("all");
    expect(parseKindFilter(undefined)).toBe("all");
    expect(parseKindFilter(42)).toBe("all");
    expect(parseKindFilter({})).toBe("all");
  });

  it("takes the first element of an array input", () => {
    expect(parseKindFilter(["movie", "book"])).toBe("movie");
  });

  it("collapses an array whose first element is invalid to all", () => {
    expect(parseKindFilter(["nope", "movie"])).toBe("all");
    expect(parseKindFilter([])).toBe("all");
  });
});

describe("kindFilterToKind", () => {
  it("maps all to null", () => {
    expect(kindFilterToKind("all")).toBeNull();
  });

  it("maps each concrete filter to its kind", () => {
    expect(kindFilterToKind("movie")).toBe("movie");
    expect(kindFilterToKind("tv")).toBe("tv");
    expect(kindFilterToKind("book")).toBe("book");
  });
});
