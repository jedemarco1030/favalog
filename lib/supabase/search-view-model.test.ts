import { describe, expect, it } from "vitest";

import {
  mapSearchRowsToMediaItems,
  mapSearchRowToMediaItem,
  type SearchRpcRow,
} from "./search-view-model";

function makeRow(overrides: Partial<SearchRpcRow> = {}): SearchRpcRow {
  return {
    media_id: "00000000-0000-0000-0000-0000000000c1",
    slug: "afterglow",
    kind: "movie",
    title: "Afterglow",
    subtitle: "",
    synopsis: "A luminous drama.",
    year: 2024,
    poster_url: "/media/posters/afterglow.svg",
    backdrop_url: "/media/backdrops/afterglow.svg",
    average_rating: 4.2,
    genres: ["Drama"],
    details: {},
    rank: 0.9,
    ...overrides,
  };
}

describe("mapSearchRowToMediaItem", () => {
  it("maps a movie row, reading movie-specific fields from details", () => {
    const item = mapSearchRowToMediaItem(
      makeRow({
        media_id: "movie-id",
        slug: "afterglow",
        kind: "movie",
        details: {
          director: "Marek Halloran",
          cast: ["Nadia Reyes", "Idris Kane"],
          runtimeMinutes: 118,
        },
      }),
    );

    expect(item.id).toBe("movie-id");
    expect(item.slug).toBe("afterglow");
    expect(item.kind).toBe("movie");
    if (item.kind !== "movie") throw new Error("expected movie");
    expect(item.director).toBe("Marek Halloran");
    expect(item.cast).toEqual(["Nadia Reyes", "Idris Kane"]);
    expect(item.runtimeMinutes).toBe(118);
  });

  it("maps a tv row, reading tv-specific fields from details", () => {
    const item = mapSearchRowToMediaItem(
      makeRow({
        media_id: "tv-id",
        slug: "northlight",
        kind: "tv",
        details: {
          seasons: 3,
          episodes: 24,
          creators: ["Lena Voss"],
          status: "ended",
        },
      }),
    );

    expect(item.id).toBe("tv-id");
    expect(item.slug).toBe("northlight");
    expect(item.kind).toBe("tv");
    if (item.kind !== "tv") throw new Error("expected tv");
    expect(item.seasons).toBe(3);
    expect(item.episodes).toBe(24);
    expect(item.creators).toEqual(["Lena Voss"]);
    expect(item.status).toBe("ended");
  });

  it("maps a book row, reading book-specific fields from details", () => {
    const item = mapSearchRowToMediaItem(
      makeRow({
        media_id: "book-id",
        slug: "field-notes",
        kind: "book",
        details: {
          authors: ["Devon Halle"],
          pageCount: 274,
          publisher: "Northwind Press",
        },
      }),
    );

    expect(item.id).toBe("book-id");
    expect(item.slug).toBe("field-notes");
    expect(item.kind).toBe("book");
    if (item.kind !== "book") throw new Error("expected book");
    expect(item.authors).toEqual(["Devon Halle"]);
    expect(item.pageCount).toBe(274);
    expect(item.publisher).toBe("Northwind Press");
  });
});

describe("mapSearchRowsToMediaItems", () => {
  it("maps many rows preserving order", () => {
    const items = mapSearchRowsToMediaItems([
      makeRow({ media_id: "a", slug: "a", kind: "movie" }),
      makeRow({ media_id: "b", slug: "b", kind: "book" }),
      makeRow({ media_id: "c", slug: "c", kind: "tv" }),
    ]);

    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(items.map((i) => i.kind)).toEqual(["movie", "book", "tv"]);
  });
});
