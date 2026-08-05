import { describe, expect, it } from "vitest";

import type { MediaItemRow } from "./mappers";
import { mapMediaRowsToDomain, mapMediaRowToDomain } from "./mappers";

/**
 * Base row factory — every media_items column with sensible defaults, so each
 * test only overrides what it cares about.
 */
function makeRow(overrides: Partial<MediaItemRow> = {}): MediaItemRow {
  return {
    id: "00000000-0000-0000-0000-0000000000b1",
    kind: "movie",
    source: "favalog",
    external_id: "dune-part-two",
    slug: "dune-part-two",
    title: "Dune: Part Two",
    subtitle: null,
    synopsis: "A desert epic.",
    year: 2024,
    poster_url: "/media/posters/duneparttwo.svg",
    backdrop_url: "/media/backdrops/duneparttwo.svg",
    average_rating: 4.7,
    genres: ["Science Fiction", "Epic"],
    details: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapMediaRowToDomain", () => {
  it("maps a movie row, reading movie-specific fields from details", () => {
    const item = mapMediaRowToDomain(
      makeRow({
        kind: "movie",
        details: {
          runtimeMinutes: 166,
          director: "Marek Halloran",
          cast: ["Nadia Reyes", "Idris Kane"],
        },
      }),
    );

    expect(item.kind).toBe("movie");
    if (item.kind !== "movie") throw new Error("expected movie");
    expect(item.runtimeMinutes).toBe(166);
    expect(item.director).toBe("Marek Halloran");
    expect(item.cast).toEqual(["Nadia Reyes", "Idris Kane"]);
    // Shared fields come from normal columns.
    expect(item.slug).toBe("dune-part-two");
    expect(item.averageRating).toBe(4.7);
    expect(item.genres).toEqual(["Science Fiction", "Epic"]);
  });

  it("maps a tv row and normalizes an invalid status to 'ongoing'", () => {
    const item = mapMediaRowToDomain(
      makeRow({
        kind: "tv",
        details: {
          seasons: 2,
          episodes: 16,
          creators: ["Lena Voss"],
          status: "not-a-real-status",
        },
      }),
    );

    expect(item.kind).toBe("tv");
    if (item.kind !== "tv") throw new Error("expected tv");
    expect(item.seasons).toBe(2);
    expect(item.episodes).toBe(16);
    expect(item.creators).toEqual(["Lena Voss"]);
    expect(item.status).toBe("ongoing");
  });

  it("preserves a valid tv status", () => {
    const item = mapMediaRowToDomain(
      makeRow({ kind: "tv", details: { status: "ended" } }),
    );
    if (item.kind !== "tv") throw new Error("expected tv");
    expect(item.status).toBe("ended");
  });

  it("maps a book row, treating a missing publisher as undefined", () => {
    const item = mapMediaRowToDomain(
      makeRow({
        kind: "book",
        subtitle: "A Field Guide",
        details: { authors: ["Devon Halle"], pageCount: 274 },
      }),
    );

    expect(item.kind).toBe("book");
    if (item.kind !== "book") throw new Error("expected book");
    expect(item.authors).toEqual(["Devon Halle"]);
    expect(item.pageCount).toBe(274);
    expect(item.publisher).toBeUndefined();
    expect(item.subtitle).toBe("A Field Guide");
  });

  it("falls back safely when details fields are missing or wrong-typed", () => {
    const item = mapMediaRowToDomain(
      makeRow({
        kind: "movie",
        // Non-object JSONB and no fields -> defaults, never a crash.
        details: null,
        average_rating: null,
        backdrop_url: null,
        poster_url: null,
      }),
    );

    if (item.kind !== "movie") throw new Error("expected movie");
    expect(item.runtimeMinutes).toBe(0);
    expect(item.director).toBe("");
    expect(item.cast).toEqual([]);
    expect(item.averageRating).toBeUndefined();
    expect(item.backdropUrl).toBeUndefined();
    expect(item.posterUrl).toBe("");
  });

  it("maps many rows preserving order", () => {
    const items = mapMediaRowsToDomain([
      makeRow({ id: "a", slug: "a", kind: "movie" }),
      makeRow({ id: "b", slug: "b", kind: "book" }),
    ]);
    expect(items.map((i) => i.kind)).toEqual(["movie", "book"]);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
