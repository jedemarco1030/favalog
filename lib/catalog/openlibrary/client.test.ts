import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../http";
import type { CatalogLogSink } from "../log";
import type { RetryEnvironment } from "../reliability";
import { createOpenLibraryProvider } from "./client";
import author from "./__fixtures__/author.json";
import search from "./__fixtures__/search.json";
import work from "./__fixtures__/work.json";
import workIncomplete from "./__fixtures__/work-incomplete.json";

const retryEnv: RetryEnvironment = { sleep: async () => {}, random: () => 0 };
const logSink: CatalogLogSink = () => {};

function res(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

const router: FetchLike = async (url) => {
  if (url.includes("/search.json")) return res(search);
  if (url.includes("/works/OL27448W.json")) return res(work);
  if (url.includes("/works/OL9999W.json")) return res(workIncomplete);
  if (url.includes("/authors/OL26320A.json")) return res(author);
  return res({}, { ok: false, status: 404 });
};

function provider(fetchImpl: FetchLike = router) {
  return createOpenLibraryProvider({
    contact: "dev@example.com",
    fetchImpl,
    retryEnv,
    logSink,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Open Library provider search", () => {
  it("returns book candidates keyed by Work id, filtering rows without a key", async () => {
    const page = await provider().search({ query: "tolkien", kind: "book" });
    expect(page.items.map((c) => c.ref.externalId)).toEqual([
      "OL27448W",
      "OL45804W",
    ]);
    expect(page.items.every((c) => c.kind === "book")).toBe(true);
    expect(page.hasMore).toBe(true); // 1 * 25 < numFound 30
  });

  it("returns nothing for a movie/tv-only filter (books only)", async () => {
    const page = await provider().search({ query: "tolkien", kind: "movie" });
    expect(page.items).toEqual([]);
  });
});

describe("Open Library provider getByExternalId", () => {
  it("resolves the Work with authors, year, cover and description", async () => {
    const item = await provider().getByExternalId({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL27448W",
    });
    expect(item.kind).toBe("book");
    expect(item.title).toBe("The Lord of the Rings");
    expect(item.year).toBe(1954);
    expect(item.synopsis).toContain("One Ring");
    expect(item.posterUrl).toBe(
      "https://covers.openlibrary.org/b/id/258027-L.jpg",
    );
    if (item.kind === "book") {
      expect(item.authors).toEqual(["J.R.R. Tolkien"]);
    }
  });

  it("degrades gracefully for an incomplete work (no cover/date/authors)", async () => {
    const item = await provider().getByExternalId({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL9999W",
    });
    expect(item.posterUrl).toBeUndefined();
    expect(item.year).toBe(0);
    if (item.kind === "book") {
      expect(item.authors).toEqual([]);
    }
  });
});

describe("Open Library provider configuration", () => {
  it("fails closed with not_configured when no contact is available", async () => {
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "");
    const unconfigured = createOpenLibraryProvider({
      fetchImpl: router,
      retryEnv,
      logSink,
    });
    await expect(
      unconfigured.search({ query: "tolkien" }),
    ).rejects.toMatchObject({
      category: "not_configured",
    });
  });

  it("sends an identifying User-Agent including the contact", async () => {
    let seenUa: string | undefined;
    const spyFetch: FetchLike = async (url, init) => {
      seenUa = (init?.headers as Record<string, string> | undefined)?.[
        "User-Agent"
      ];
      return router(url, init);
    };
    await provider(spyFetch).search({ query: "tolkien", kind: "book" });
    expect(seenUa).toContain("Favalog");
    expect(seenUa).toContain("dev@example.com");
  });
});
