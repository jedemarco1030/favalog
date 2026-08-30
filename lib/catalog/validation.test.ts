import { describe, expect, it } from "vitest";

import { MAX_PAGE, MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "./config";
import {
  clampPage,
  externalKeyFor,
  normalizeQuery,
  parseMediaKind,
  parseProvider,
  validateExternalId,
  validateMaterializeInput,
} from "./validation";

describe("parseProvider", () => {
  it("accepts known provider ids", () => {
    expect(parseProvider("tmdb")).toBe("tmdb");
    expect(parseProvider("openlibrary")).toBe("openlibrary");
  });

  it("returns null for unknown / missing input", () => {
    expect(parseProvider("google")).toBeNull();
    expect(parseProvider("")).toBeNull();
    expect(parseProvider(undefined)).toBeNull();
  });
});

describe("parseMediaKind", () => {
  it("accepts known media kinds", () => {
    expect(parseMediaKind("movie")).toBe("movie");
    expect(parseMediaKind("tv")).toBe("tv");
    expect(parseMediaKind("book")).toBe("book");
  });

  it("returns null for unknown / missing input", () => {
    expect(parseMediaKind("game")).toBeNull();
    expect(parseMediaKind("")).toBeNull();
    expect(parseMediaKind(undefined)).toBeNull();
  });
});

describe("normalizeQuery", () => {
  it("trims and collapses internal whitespace", () => {
    const result = normalizeQuery("  the   matrix  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("the matrix");
  });

  it("rejects a query shorter than MIN_QUERY_LENGTH", () => {
    const result = normalizeQuery("a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least/i);
  });

  it("rejects blank / missing input", () => {
    expect(normalizeQuery("   ").ok).toBe(false);
    expect(normalizeQuery(undefined).ok).toBe(false);
  });

  it("rejects a query longer than MAX_QUERY_LENGTH", () => {
    const result = normalizeQuery("x".repeat(MAX_QUERY_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at most/i);
  });

  it("accepts the boundary lengths", () => {
    expect(normalizeQuery("x".repeat(MIN_QUERY_LENGTH)).ok).toBe(true);
    expect(normalizeQuery("x".repeat(MAX_QUERY_LENGTH)).ok).toBe(true);
  });
});

describe("clampPage", () => {
  it("returns the page unchanged when in range", () => {
    expect(clampPage(1)).toBe(1);
    expect(clampPage(5)).toBe(5);
    expect(clampPage(MAX_PAGE)).toBe(MAX_PAGE);
  });

  it("floors fractional pages", () => {
    expect(clampPage(3.9)).toBe(3);
  });

  it("clamps above MAX_PAGE down to MAX_PAGE", () => {
    expect(clampPage(MAX_PAGE + 100)).toBe(MAX_PAGE);
  });

  it("defaults to 1 for undefined, NaN, and values below 1", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(Number.NaN)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
  });
});

describe("validateExternalId", () => {
  it("accepts a positive-integer TMDB id", () => {
    const result = validateExternalId("tmdb", "movie", " 603 ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("603");
  });

  it("rejects a non-numeric TMDB id", () => {
    expect(validateExternalId("tmdb", "movie", "603x").ok).toBe(false);
    expect(validateExternalId("tmdb", "tv", "abc").ok).toBe(false);
  });

  it("accepts a well-formed Open Library Work id for a book", () => {
    const result = validateExternalId("openlibrary", "book", "OL45804W");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("OL45804W");
  });

  it("rejects a malformed Open Library Work id", () => {
    expect(validateExternalId("openlibrary", "book", "OL45804M").ok).toBe(
      false,
    );
    expect(validateExternalId("openlibrary", "book", "45804W").ok).toBe(false);
    expect(validateExternalId("openlibrary", "book", "OLW").ok).toBe(false);
  });

  it("rejects an empty id for either provider", () => {
    expect(validateExternalId("tmdb", "movie", "   ").ok).toBe(false);
    expect(validateExternalId("openlibrary", "book", "").ok).toBe(false);
  });

  it("rejects an Open Library non-book combination", () => {
    expect(validateExternalId("openlibrary", "movie", "OL45804W").ok).toBe(
      false,
    );
  });
});

describe("externalKeyFor", () => {
  it("kind-qualifies TMDB ids so movie and tv never collide", () => {
    expect(externalKeyFor("tmdb", "movie", "603")).toBe("movie:603");
    expect(externalKeyFor("tmdb", "tv", "603")).toBe("tv:603");
    expect(externalKeyFor("tmdb", "movie", "603")).not.toBe(
      externalKeyFor("tmdb", "tv", "603"),
    );
  });

  it("stores an Open Library Work id unchanged", () => {
    expect(externalKeyFor("openlibrary", "book", "OL45804W")).toBe("OL45804W");
  });
});

describe("validateMaterializeInput", () => {
  it("rejects an unknown provider", () => {
    const result = validateMaterializeInput({
      provider: "google",
      kind: "movie",
      externalId: "1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown provider/i);
  });

  it("rejects an unknown media kind", () => {
    const result = validateMaterializeInput({
      provider: "tmdb",
      kind: "game",
      externalId: "1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown media kind/i);
  });

  it("rejects a provider that does not serve the kind", () => {
    const tmdbBook = validateMaterializeInput({
      provider: "tmdb",
      kind: "book",
      externalId: "1",
    });
    expect(tmdbBook.ok).toBe(false);
    if (!tmdbBook.ok) expect(tmdbBook.error).toMatch(/does not serve/i);

    const olMovie = validateMaterializeInput({
      provider: "openlibrary",
      kind: "movie",
      externalId: "OL1W",
    });
    expect(olMovie.ok).toBe(false);
    if (!olMovie.ok) expect(olMovie.error).toMatch(/does not serve/i);
  });

  it("rejects a malformed external id", () => {
    const result = validateMaterializeInput({
      provider: "tmdb",
      kind: "movie",
      externalId: "not-a-number",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid TMDB movie and returns the cleaned input", () => {
    const result = validateMaterializeInput({
      provider: "tmdb",
      kind: "movie",
      externalId: " 603 ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        provider: "tmdb",
        kind: "movie",
        externalId: "603",
      });
    }
  });

  it("accepts a valid TMDB tv show", () => {
    const result = validateMaterializeInput({
      provider: "tmdb",
      kind: "tv",
      externalId: "1399",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        provider: "tmdb",
        kind: "tv",
        externalId: "1399",
      });
    }
  });

  it("accepts a valid Open Library book", () => {
    const result = validateMaterializeInput({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL45804W",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        provider: "openlibrary",
        kind: "book",
        externalId: "OL45804W",
      });
    }
  });
});
