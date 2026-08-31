import { describe, expect, it } from "vitest";

import {
  EMBEDDABLE_SOURCES,
  EMBEDDING_EXCLUDED_SOURCES,
  classifyEmbeddingSource,
  isSourceEmbeddable,
  partitionEmbeddableRows,
} from "./embedding-source-policy";

describe("isSourceEmbeddable (strict allowlist / default deny)", () => {
  it("permits curated Favalog rows (existing behavior)", () => {
    expect(isSourceEmbeddable("favalog")).toBe(true);
  });

  it("permits Open Library rows (a permitted source)", () => {
    expect(isSourceEmbeddable("openlibrary")).toBe(true);
  });

  it("EXCLUDES TMDB rows by default", () => {
    expect(isSourceEmbeddable("tmdb")).toBe(false);
  });

  it("normalizes case and surrounding whitespace before deciding", () => {
    expect(isSourceEmbeddable("  Favalog ")).toBe(true);
    expect(isSourceEmbeddable("TMDB")).toBe(false);
  });

  it.each([null, undefined, "", "   ", "unknown", "google_books", "imdb"])(
    "fails closed for the missing/unknown source %p (a missing policy cannot silently allow embedding)",
    (source) => {
      expect(isSourceEmbeddable(source as string | null | undefined)).toBe(
        false,
      );
    },
  );

  it("keeps TMDB out of the allowlist and in the excluded set", () => {
    expect([...EMBEDDABLE_SOURCES]).not.toContain("tmdb");
    expect([...EMBEDDING_EXCLUDED_SOURCES]).toContain("tmdb");
  });
});

describe("classifyEmbeddingSource", () => {
  it("labels permitted, TMDB, and unknown decisions distinctly", () => {
    expect(classifyEmbeddingSource("favalog")).toBe("permitted");
    expect(classifyEmbeddingSource("openlibrary")).toBe("permitted");
    expect(classifyEmbeddingSource("tmdb")).toBe("excluded_tmdb");
    expect(classifyEmbeddingSource("mystery")).toBe("excluded_unknown");
    expect(classifyEmbeddingSource(null)).toBe("excluded_unknown");
  });
});

describe("partitionEmbeddableRows", () => {
  it("splits rows by policy while preserving order and dropping TMDB", () => {
    const rows = [
      { id: "1", source: "favalog" },
      { id: "2", source: "tmdb" },
      { id: "3", source: "openlibrary" },
      { id: "4", source: null },
      { id: "5", source: "favalog" },
    ];
    const { embeddable, excluded } = partitionEmbeddableRows(rows);
    expect(embeddable.map((r) => r.id)).toEqual(["1", "3", "5"]);
    expect(excluded.map((r) => r.id)).toEqual(["2", "4"]);
  });
});
