import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMBEDDING_SOURCE_POLICY,
  EMBEDDABLE_SOURCES,
  type EmbeddingSourcePolicy,
  PROVIDER_GATED_EMBEDDABLE_SOURCES,
  classifyEmbeddingSource,
  isSourceEmbeddable,
  partitionEmbeddableRows,
} from "./embedding-source-policy";

/** An explicit policy with TMDB embedding turned ON (operator opt-in). */
const TMDB_ON: EmbeddingSourcePolicy = { tmdbEmbeddingEnabled: true };

describe("isSourceEmbeddable (strict allowlist / default deny)", () => {
  it("permits curated Favalog rows (existing behavior)", () => {
    expect(isSourceEmbeddable("favalog")).toBe(true);
  });

  it("permits Open Library rows (a permitted source)", () => {
    expect(isSourceEmbeddable("openlibrary")).toBe(true);
  });

  it("EXCLUDES TMDB rows by default (no policy supplied)", () => {
    expect(isSourceEmbeddable("tmdb")).toBe(false);
  });

  it("EXCLUDES TMDB rows under the explicit default policy", () => {
    expect(isSourceEmbeddable("tmdb", DEFAULT_EMBEDDING_SOURCE_POLICY)).toBe(
      false,
    );
  });

  it("PERMITS TMDB rows only when the policy explicitly enables it", () => {
    expect(isSourceEmbeddable("tmdb", TMDB_ON)).toBe(true);
    expect(isSourceEmbeddable("  TMDB ", TMDB_ON)).toBe(true);
  });

  it("normalizes case and surrounding whitespace before deciding", () => {
    expect(isSourceEmbeddable("  Favalog ")).toBe(true);
    expect(isSourceEmbeddable("TMDB")).toBe(false);
  });

  it.each([null, undefined, "", "   ", "unknown", "google_books", "imdb"])(
    "fails closed for the missing/unknown source %p even when TMDB is enabled",
    (source) => {
      expect(isSourceEmbeddable(source as string | null | undefined)).toBe(
        false,
      );
      // Enabling TMDB must never widen eligibility to other unknown sources.
      expect(
        isSourceEmbeddable(source as string | null | undefined, TMDB_ON),
      ).toBe(false);
    },
  );

  it("keeps TMDB out of the always-embeddable set and in the provider-gated set", () => {
    expect([...EMBEDDABLE_SOURCES]).not.toContain("tmdb");
    expect([...PROVIDER_GATED_EMBEDDABLE_SOURCES]).toContain("tmdb");
  });
});

describe("classifyEmbeddingSource", () => {
  it("labels permitted, TMDB-off, and unknown decisions distinctly (default policy)", () => {
    expect(classifyEmbeddingSource("favalog")).toBe("permitted");
    expect(classifyEmbeddingSource("openlibrary")).toBe("permitted");
    expect(classifyEmbeddingSource("tmdb")).toBe("excluded_tmdb");
    expect(classifyEmbeddingSource("mystery")).toBe("excluded_unknown");
    expect(classifyEmbeddingSource(null)).toBe("excluded_unknown");
  });

  it("labels TMDB as permitted once the policy enables it", () => {
    expect(classifyEmbeddingSource("tmdb", TMDB_ON)).toBe("permitted");
    // An unknown source stays excluded regardless of the TMDB toggle.
    expect(classifyEmbeddingSource("mystery", TMDB_ON)).toBe(
      "excluded_unknown",
    );
  });
});

describe("partitionEmbeddableRows", () => {
  const rows = [
    { id: "1", source: "favalog" },
    { id: "2", source: "tmdb" },
    { id: "3", source: "openlibrary" },
    { id: "4", source: null },
    { id: "5", source: "favalog" },
  ];

  it("splits rows by policy while preserving order and dropping TMDB by default", () => {
    const { embeddable, excluded } = partitionEmbeddableRows(rows);
    expect(embeddable.map((r) => r.id)).toEqual(["1", "3", "5"]);
    expect(excluded.map((r) => r.id)).toEqual(["2", "4"]);
  });

  it("includes TMDB rows (but not unknown rows) when the policy enables TMDB", () => {
    const { embeddable, excluded } = partitionEmbeddableRows(rows, TMDB_ON);
    expect(embeddable.map((r) => r.id)).toEqual(["1", "2", "3", "5"]);
    expect(excluded.map((r) => r.id)).toEqual(["4"]);
  });
});
