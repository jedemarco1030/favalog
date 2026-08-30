import { describe, expect, it } from "vitest";

import {
  buildExternalResultViews,
  candidateResolutionKey,
  PROVIDER_LABEL,
  toExternalResultView,
} from "./external-result-view-model";
import type { CatalogSearchCandidate } from "./types";

function tmdbMovie(
  id: string,
  extra: Partial<CatalogSearchCandidate> = {},
): CatalogSearchCandidate {
  return {
    ref: { provider: "tmdb", kind: "movie", externalId: id },
    kind: "movie",
    title: "Dune: Part Two",
    year: 2024,
    posterUrl: "https://image.tmdb.org/t/p/w500/x.jpg",
    ...extra,
  };
}

function openLibraryBook(id: string): CatalogSearchCandidate {
  return {
    ref: { provider: "openlibrary", kind: "book", externalId: id },
    kind: "book",
    title: "Dune",
    year: 1965,
  };
}

describe("candidateResolutionKey", () => {
  it("kind-qualifies TMDB ids so a movie and TV id can never collide", () => {
    expect(candidateResolutionKey(tmdbMovie("693134"))).toBe("movie:693134");
    expect(
      candidateResolutionKey({
        ref: { provider: "tmdb", kind: "tv", externalId: "693134" },
        kind: "tv",
        title: "Something",
      }),
    ).toBe("tv:693134");
  });

  it("uses the Open Library Work id as-is", () => {
    expect(candidateResolutionKey(openLibraryBook("OL45804W"))).toBe(
      "OL45804W",
    );
  });
});

describe("toExternalResultView", () => {
  it("marks a candidate importable when no canonical slug resolves", () => {
    const view = toExternalResultView(tmdbMovie("693134"), undefined);
    expect(view.status).toBe("importable");
    expect(view.existingSlug).toBeUndefined();
    expect(view.provider).toBe("tmdb");
    expect(view.providerLabel).toBe(PROVIDER_LABEL.tmdb);
    expect(view.externalId).toBe("693134");
    expect(view.title).toBe("Dune: Part Two");
    expect(view.year).toBe(2024);
    expect(view.posterUrl).toBe("https://image.tmdb.org/t/p/w500/x.jpg");
  });

  it("marks a candidate existing and carries the canonical slug when resolved", () => {
    const view = toExternalResultView(tmdbMovie("693134"), "dune-part-two");
    expect(view.status).toBe("existing");
    expect(view.existingSlug).toBe("dune-part-two");
  });

  it("omits optional fields that the candidate does not carry", () => {
    const view = toExternalResultView(openLibraryBook("OL45804W"), undefined);
    expect(view.posterUrl).toBeUndefined();
    expect(view.subtitle).toBeUndefined();
    expect(view.providerLabel).toBe("Open Library");
    expect(view.year).toBe(1965);
  });

  it("never fabricates a rating or community field", () => {
    const view = toExternalResultView(tmdbMovie("1"), undefined);
    expect(view).not.toHaveProperty("averageRating");
    expect(view).not.toHaveProperty("rating");
    expect(view).not.toHaveProperty("reviewCount");
  });
});

describe("buildExternalResultViews", () => {
  it("drops a candidate already represented in the local results", () => {
    const candidates = [
      tmdbMovie("693134"),
      tmdbMovie("1", { title: "Other" }),
    ];
    const resolved = new Map([["movie:693134", "dune-part-two"]]);
    const views = buildExternalResultViews(
      candidates,
      resolved,
      ["dune-part-two"], // already shown locally
      10,
    );
    expect(views.map((v) => v.externalId)).toEqual(["1"]);
    expect(views[0].status).toBe("importable");
  });

  it("keeps an existing (canonically linked) title not in the local results as a link", () => {
    const views = buildExternalResultViews(
      [tmdbMovie("693134")],
      new Map([["movie:693134", "dune-part-two"]]),
      [],
      10,
    );
    expect(views).toHaveLength(1);
    expect(views[0].status).toBe("existing");
    expect(views[0].existingSlug).toBe("dune-part-two");
  });

  it("de-duplicates repeated candidates resolving to the same canonical title", () => {
    const dupA = tmdbMovie("693134");
    const dupB = tmdbMovie("693134");
    const views = buildExternalResultViews(
      [dupA, dupB],
      new Map([["movie:693134", "dune-part-two"]]),
      [],
      10,
    );
    expect(views).toHaveLength(1);
  });

  it("caps the result set at the requested limit", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      tmdbMovie(String(i + 100), { title: `Movie ${i}` }),
    );
    const views = buildExternalResultViews(many, new Map(), [], 6);
    expect(views).toHaveLength(6);
  });
});
