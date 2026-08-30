import { describe, expect, it } from "vitest";

import { normalizedContentHash } from "./provenance";
import type { NormalizedMediaItem } from "./types";

function movie(
  overrides: Partial<Extract<NormalizedMediaItem, { kind: "movie" }>> = {},
): NormalizedMediaItem {
  return {
    ref: { provider: "tmdb", kind: "movie", externalId: "603" },
    kind: "movie",
    title: "The Matrix",
    synopsis: "A hacker discovers reality is a simulation.",
    year: 1999,
    genres: ["Action", "Sci-Fi"],
    posterUrl: "https://image.tmdb.org/t/p/w500/matrix.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/matrix-bd.jpg",
    averageRating: 4.3,
    runtimeMinutes: 136,
    director: "Lana Wachowski",
    cast: ["Keanu Reeves", "Carrie-Anne Moss"],
    ...overrides,
  };
}

function tv(
  overrides: Partial<Extract<NormalizedMediaItem, { kind: "tv" }>> = {},
): NormalizedMediaItem {
  return {
    ref: { provider: "tmdb", kind: "tv", externalId: "1399" },
    kind: "tv",
    title: "Fringe",
    synopsis: "An FBI team investigates fringe science.",
    year: 2008,
    genres: ["Drama", "Sci-Fi"],
    seasons: 5,
    episodes: 100,
    creators: ["J.J. Abrams"],
    status: "ended",
    ...overrides,
  };
}

function book(
  overrides: Partial<Extract<NormalizedMediaItem, { kind: "book" }>> = {},
): NormalizedMediaItem {
  return {
    ref: { provider: "openlibrary", kind: "book", externalId: "OL45804W" },
    kind: "book",
    title: "Fantastic Mr Fox",
    synopsis: "A clever fox outwits three farmers.",
    year: 1970,
    genres: ["Children"],
    authors: ["Roald Dahl"],
    pageCount: 96,
    ...overrides,
  };
}

const HEX64 = /^[0-9a-f]{64}$/;

describe("normalizedContentHash", () => {
  it("returns a 64-char lowercase hex string for each kind", () => {
    expect(normalizedContentHash(movie())).toMatch(HEX64);
    expect(normalizedContentHash(tv())).toMatch(HEX64);
    expect(normalizedContentHash(book())).toMatch(HEX64);
  });

  it("is deterministic: same input yields the same hash", () => {
    expect(normalizedContentHash(movie())).toBe(normalizedContentHash(movie()));
    expect(normalizedContentHash(book())).toBe(normalizedContentHash(book()));
  });

  it("changes when the title changes", () => {
    expect(normalizedContentHash(movie())).not.toBe(
      normalizedContentHash(movie({ title: "The Matrix Reloaded" })),
    );
  });

  it("changes when the year changes", () => {
    expect(normalizedContentHash(movie())).not.toBe(
      normalizedContentHash(movie({ year: 2000 })),
    );
  });

  it("changes when a kind-specific detail field changes", () => {
    expect(normalizedContentHash(movie())).not.toBe(
      normalizedContentHash(movie({ runtimeMinutes: 137 })),
    );
    expect(normalizedContentHash(tv())).not.toBe(
      normalizedContentHash(tv({ status: "ongoing" })),
    );
    expect(normalizedContentHash(book())).not.toBe(
      normalizedContentHash(book({ pageCount: 100 })),
    );
  });

  it("changes when the genres change", () => {
    expect(normalizedContentHash(movie())).not.toBe(
      normalizedContentHash(movie({ genres: ["Action"] })),
    );
  });

  it("is stable regardless of object key insertion order", () => {
    const base = movie();
    // Rebuild the same logical item with keys in a different insertion order.
    const reordered: NormalizedMediaItem = {
      cast: base.kind === "movie" ? base.cast : [],
      director: base.kind === "movie" ? base.director : "",
      runtimeMinutes: base.kind === "movie" ? base.runtimeMinutes : 0,
      averageRating: base.averageRating,
      backdropUrl: base.backdropUrl,
      posterUrl: base.posterUrl,
      genres: base.genres,
      year: base.year,
      synopsis: base.synopsis,
      title: base.title,
      kind: "movie",
      ref: {
        externalId: base.ref.externalId,
        kind: base.ref.kind,
        provider: base.ref.provider,
      },
    };
    expect(normalizedContentHash(reordered)).toBe(normalizedContentHash(base));
  });
});
