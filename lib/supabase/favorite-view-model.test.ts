import { describe, expect, it } from "vitest";

import type { MediaItemRow } from "./mappers";
import {
  toFavoriteView,
  toFavoriteViews,
  type FavoriteRowLike,
} from "./favorite-view-model";

/** A minimal media_items row factory for the join payload. */
function makeMediaRow(overrides: Partial<MediaItemRow> = {}): MediaItemRow {
  return {
    id: "00000000-0000-0000-0000-0000000000b1",
    kind: "movie",
    source: "favalog",
    external_id: "afterglow",
    slug: "afterglow",
    title: "Afterglow",
    subtitle: null,
    synopsis: "A quiet drama.",
    year: 2023,
    poster_url: "/p.svg",
    backdrop_url: null,
    average_rating: null,
    genres: ["Drama"],
    details: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    content_hash: null,
    normalization_version: null,
    synced_at: null,
    search_tsv: null,
    ...overrides,
  };
}

function makeFavoriteRow(
  id: string,
  position: number,
  media: Partial<MediaItemRow>,
): FavoriteRowLike {
  return { id, position, media_items: makeMediaRow(media) };
}

describe("toFavoriteView", () => {
  it("maps a favorite row to a view with its position and domain media", () => {
    const view = toFavoriteView(
      makeFavoriteRow("f1", 0, { slug: "afterglow", title: "Afterglow" }),
    );
    expect(view.id).toBe("f1");
    expect(view.position).toBe(0);
    expect(view.media.slug).toBe("afterglow");
    expect(view.media.kind).toBe("movie");
  });

  it("resolves each media kind through the shared domain mapper", () => {
    const book = toFavoriteView(
      makeFavoriteRow("f2", 1, {
        kind: "book",
        slug: "the-small-hours",
        title: "The Small Hours",
        details: { authors: ["A. Writer"], pageCount: 200 },
      }),
    );
    expect(book.media.kind).toBe("book");
  });
});

describe("toFavoriteViews", () => {
  it("orders favorites by their stored position regardless of input order", () => {
    const views = toFavoriteViews([
      makeFavoriteRow("f-c", 2, { slug: "low-country", title: "Low Country" }),
      makeFavoriteRow("f-a", 0, { slug: "afterglow", title: "Afterglow" }),
      makeFavoriteRow("f-b", 1, { slug: "northlight", title: "Northlight" }),
    ]);
    expect(views.map((v) => v.media.slug)).toEqual([
      "afterglow",
      "northlight",
      "low-country",
    ]);
    expect(views.map((v) => v.position)).toEqual([0, 1, 2]);
  });

  it("returns an empty array for no favorites", () => {
    expect(toFavoriteViews([])).toEqual([]);
  });
});
