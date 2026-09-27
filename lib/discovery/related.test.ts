import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: vi.fn() }));

import {
  authorIdFromWork,
  collectionFromTmdbMovie,
  developerFromRawgGame,
  normalizeOpenLibraryAuthorWorks,
  normalizeRawgDeveloperGames,
  normalizeTmdbCollection,
  relatedHeading,
  RELATED_LIMIT,
} from "./related";
import { getRelatedTitles } from "./related-service";
import type { CacheWrapper } from "./service";

const passThrough: CacheWrapper = (fn) => fn();

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("TMDB collections", () => {
  it("reads only an explicit collection link", () => {
    expect(
      collectionFromTmdbMovie({
        belongs_to_collection: { id: 726871, name: "Dune Collection" },
      }),
    ).toEqual({ id: 726871, name: "Dune Collection" });
    expect(collectionFromTmdbMovie({ belongs_to_collection: null })).toBeNull();
    expect(
      collectionFromTmdbMovie({
        belongs_to_collection: { id: "x", name: "A" },
      }),
    ).toBeNull();
  });

  it("orders parts by release date, excludes the source and adult parts", () => {
    const result = normalizeTmdbCollection(
      {
        parts: [
          { id: 3, title: "Part Three", release_date: "" },
          { id: 2, title: "Part Two", release_date: "2024-02-27" },
          { id: 1, title: "Part One", release_date: "2021-09-15" },
          { id: 9, title: "Adult", adult: true, release_date: "2020-01-01" },
        ],
      },
      "2",
    );
    expect(result.map((c) => c.title)).toEqual(["Part One", "Part Three"]);
    expect(result[0]).toMatchObject({
      ref: { provider: "tmdb", kind: "movie", externalId: "1" },
      rank: 1,
      year: 2021,
    });
  });
});

describe("RAWG developers", () => {
  it("uses the first developer with an id and name", () => {
    expect(
      developerFromRawgGame({
        developers: [{ id: 3612, name: "Supergiant Games" }],
      }),
    ).toEqual({ id: 3612, name: "Supergiant Games" });
    expect(developerFromRawgGame({ developers: [] })).toBeNull();
  });

  it("excludes the source game, ignores tba dates, and bounds results", () => {
    const results = Array.from({ length: RELATED_LIMIT + 3 }, (_, i) => ({
      id: i + 1,
      name: `Game ${i + 1}`,
      released: "2020-09-17",
      tba: i === 1,
    }));
    const out = normalizeRawgDeveloperGames({ results }, "1");
    expect(out).toHaveLength(RELATED_LIMIT);
    expect(out[0]).toMatchObject({ title: "Game 2", releaseDate: undefined });
    expect(out.some((c) => c.ref.externalId === "1")).toBe(false);
  });
});

describe("Open Library authors", () => {
  it("reads a well-formed first author key only", () => {
    expect(
      authorIdFromWork({ authors: [{ author: { key: "/authors/OL79034A" } }] }),
    ).toBe("OL79034A");
    expect(
      authorIdFromWork({ authors: [{ author: { key: "https://evil" } }] }),
    ).toBeNull();
  });

  it("drops the source work, duplicates, and malformed keys", () => {
    const out = normalizeOpenLibraryAuthorWorks(
      {
        entries: [
          { key: "/works/OL1W", title: "Source" },
          { key: "/works/OL2W", title: "Second", covers: [123] },
          { key: "/works/OL2W", title: "Duplicate" },
          { key: "/books/OL3M", title: "Edition" },
        ],
      },
      "OL1W",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      title: "Second",
      ref: { provider: "openlibrary", kind: "book", externalId: "OL2W" },
    });
    expect(out[0].posterUrl).toContain("/123-");
  });
});

describe("relatedHeading", () => {
  it("names the explicit relationship", () => {
    expect(
      relatedHeading({ relation: "collection", name: "Dune Collection" }),
    ).toBe("In the Dune Collection");
    expect(
      relatedHeading({
        relation: "collection",
        name: "The Avengers Collection",
      }),
    ).toBe("In The Avengers Collection");
    expect(
      relatedHeading({ relation: "developer", name: "Supergiant Games" }),
    ).toBe("More games from Supergiant Games");
    expect(relatedHeading({ relation: "author", name: "Frank Herbert" })).toBe(
      "More books by Frank Herbert",
    );
  });
});

describe("getRelatedTitles", () => {
  const ref = {
    provider: "tmdb",
    kind: "movie",
    externalId: "693134",
  } as const;

  it("returns nothing and makes no request when the provider is off", async () => {
    const fetchImpl = vi.fn();
    const result = await getRelatedTitles(ref, {
      isAvailable: () => false,
      fetchImpl,
      cache: passThrough,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("follows the collection link to its parts", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          belongs_to_collection: { id: 726871, name: "Dune Collection" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          parts: [
            { id: 438631, title: "Dune", release_date: "2021-09-15" },
            { id: 693134, title: "Dune: Part Two", release_date: "2024-02-27" },
          ],
        }),
      );
    const result = await getRelatedTitles(ref, {
      isAvailable: () => true,
      fetchImpl,
      cache: passThrough,
      credentials: { tmdbToken: "token" },
    });
    expect(result?.name).toBe("Dune Collection");
    expect(result?.candidates.map((c) => c.title)).toEqual(["Dune"]);
    expect(String(fetchImpl.mock.calls[1][0])).toContain("/collection/726871");
  });

  it("accepts the stored movie:<id> external id format", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          belongs_to_collection: { id: 726871, name: "Dune Collection" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          parts: [
            { id: 438631, title: "Dune", release_date: "2021-09-15" },
            { id: 693134, title: "Dune: Part Two", release_date: "2024-02-27" },
          ],
        }),
      );
    const result = await getRelatedTitles(
      { ...ref, externalId: "movie:693134" },
      {
        isAvailable: () => true,
        fetchImpl,
        cache: passThrough,
        credentials: { tmdbToken: "token" },
      },
    );
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/movie/693134?");
    expect(result?.candidates.map((c) => c.title)).toEqual(["Dune"]);
  });

  it("returns nothing for a title without a collection", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ belongs_to_collection: null }));
    const result = await getRelatedTitles(ref, {
      isAvailable: () => true,
      fetchImpl,
      cache: passThrough,
      credentials: { tmdbToken: "token" },
    });
    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("degrades to nothing when the provider fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 500 }));
    const result = await getRelatedTitles(ref, {
      isAvailable: () => true,
      fetchImpl,
      cache: passThrough,
      credentials: { tmdbToken: "token" },
    });
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
