import { describe, expect, it } from "vitest";

import { CatalogProviderError } from "./errors";
import { createFakeProvider } from "./fake-provider";
import type { NormalizedMediaItem } from "./types";

describe("createFakeProvider (tmdb)", () => {
  const provider = createFakeProvider({ id: "tmdb" });

  it("only serves tmdb items", async () => {
    const page = await provider.search({ query: "fixture" });
    expect(page.items.length).toBeGreaterThan(0);
    for (const item of page.items) {
      expect(item.ref.provider).toBe("tmdb");
    }
  });

  it("matches the query as a case-insensitive substring of the title", async () => {
    const page = await provider.search({ query: "series" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe("Fixture Series One");

    const upper = await provider.search({ query: "MOVIE" });
    expect(upper.items).toHaveLength(1);
    expect(upper.items[0].title).toBe("Fixture Movie One");
  });

  it("respects the kind filter", async () => {
    const movies = await provider.search({ query: "fixture", kind: "movie" });
    expect(movies.items.every((i) => i.kind === "movie")).toBe(true);
    expect(movies.items).toHaveLength(1);

    const tv = await provider.search({ query: "fixture", kind: "tv" });
    expect(tv.items.every((i) => i.kind === "tv")).toBe(true);
    expect(tv.items).toHaveLength(1);

    const books = await provider.search({ query: "fixture", kind: "book" });
    // tmdb fake serves no books.
    expect(books.items).toHaveLength(0);
  });

  it("is deterministic across repeated calls", async () => {
    const first = await provider.search({ query: "fixture" });
    const second = await provider.search({ query: "fixture" });
    expect(second.items).toEqual(first.items);
  });

  it("getByExternalId returns the matching item", async () => {
    const item = await provider.getByExternalId({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    expect(item.title).toBe("Fixture Movie One");
    expect(item.ref.externalId).toBe("1001");
  });

  it("getByExternalId throws a not_found CatalogProviderError for an unknown id", async () => {
    await expect(
      provider.getByExternalId({
        provider: "tmdb",
        kind: "movie",
        externalId: "does-not-exist",
      }),
    ).rejects.toBeInstanceOf(CatalogProviderError);

    await expect(
      provider.getByExternalId({
        provider: "tmdb",
        kind: "movie",
        externalId: "does-not-exist",
      }),
    ).rejects.toMatchObject({ category: "not_found", provider: "tmdb" });
  });
});

describe("createFakeProvider (openlibrary)", () => {
  const provider = createFakeProvider({ id: "openlibrary" });

  it("serves only the book", async () => {
    const page = await provider.search({ query: "fixture" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe("book");
    expect(page.items[0].ref.provider).toBe("openlibrary");
  });

  it("exposes only the book kind", () => {
    expect(provider.kinds).toEqual(["book"]);
  });
});

describe("createFakeProvider (custom items)", () => {
  it("respects a caller-supplied items array", async () => {
    const items: NormalizedMediaItem[] = [
      {
        ref: { provider: "tmdb", kind: "movie", externalId: "9000" },
        kind: "movie",
        title: "Custom Only",
        synopsis: "A custom fixture.",
        year: 2024,
        genres: ["Drama"],
        runtimeMinutes: 90,
        director: "Someone",
        cast: ["A"],
      },
    ];
    const provider = createFakeProvider({ id: "tmdb", items });

    const found = await provider.search({ query: "custom" });
    expect(found.items).toHaveLength(1);
    expect(found.items[0].title).toBe("Custom Only");

    const none = await provider.search({ query: "fixture movie one" });
    expect(none.items).toHaveLength(0);

    const item = await provider.getByExternalId({
      provider: "tmdb",
      kind: "movie",
      externalId: "9000",
    });
    expect(item.title).toBe("Custom Only");
  });
});
