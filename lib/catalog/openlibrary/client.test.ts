import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../http";
import type { CatalogLogEvent, CatalogLogSink } from "../log";
import type { RetryEnvironment } from "../reliability";
import {
  createOpenLibraryProvider,
  fallbackYearFromWorkKeySearch,
} from "./client";
import author from "./__fixtures__/author.json";
import search from "./__fixtures__/search.json";
import work from "./__fixtures__/work.json";
import workDuneNoDate from "./__fixtures__/work-dune-no-date.json";
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

describe("fallbackYearFromWorkKeySearch (pure)", () => {
  const KEY = "/works/OL893414W";

  it("accepts exactly one result whose key matches and whose year is in bounds", () => {
    expect(
      fallbackYearFromWorkKeySearch(
        { numFound: 1, docs: [{ key: KEY, first_publish_year: 1965 }] },
        KEY,
      ),
    ).toBe(1965);
  });

  it("rejects a mismatched key", () => {
    expect(
      fallbackYearFromWorkKeySearch(
        { docs: [{ key: "/works/OL999999W", first_publish_year: 1965 }] },
        KEY,
      ),
    ).toBeUndefined();
  });

  it("rejects a missing or out-of-bounds year", () => {
    expect(
      fallbackYearFromWorkKeySearch({ docs: [{ key: KEY }] }, KEY),
    ).toBeUndefined();
    expect(
      fallbackYearFromWorkKeySearch(
        { docs: [{ key: KEY, first_publish_year: 1400 }] },
        KEY,
      ),
    ).toBeUndefined();
  });

  it("rejects an empty, multiple, or doc-less response", () => {
    expect(fallbackYearFromWorkKeySearch({ docs: [] }, KEY)).toBeUndefined();
    expect(fallbackYearFromWorkKeySearch({}, KEY)).toBeUndefined();
    expect(
      fallbackYearFromWorkKeySearch(
        {
          docs: [
            { key: KEY, first_publish_year: 1965 },
            { key: "/works/OL111W", first_publish_year: 1999 },
          ],
        },
        KEY,
      ),
    ).toBeUndefined();
  });
});

describe("Open Library Work-key year fallback (getByExternalId)", () => {
  const DUNE_REF = {
    provider: "openlibrary" as const,
    kind: "book" as const,
    externalId: "OL893414W",
  };
  const DUNE_KEY = "/works/OL893414W";
  const DUNE_WORK_PATH = "/works/OL893414W.json";
  const DUNE_AUTHOR_PATH = "/authors/OL79034A.json";

  /**
   * Route the dateless Dune Work + its author, and delegate the fallback
   * `search.json` request to the supplied handler so each test controls it.
   */
  function duneRouter(searchHandler: (url: string) => Response): FetchLike {
    return async (url) => {
      if (url.includes("/search.json")) return searchHandler(url);
      if (url.includes(DUNE_WORK_PATH)) return res(workDuneNoDate);
      if (url.includes(DUNE_AUTHOR_PATH)) {
        return res({ key: "/authors/OL79034A", name: "Frank Herbert" });
      }
      return res({}, { ok: false, status: 404 });
    };
  }

  it("makes NO fallback Search request when the Work carries a valid date", async () => {
    let searchCalls = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("/search.json")) {
        searchCalls += 1;
        return res(search);
      }
      if (url.includes("/works/OL27448W.json")) return res(work);
      if (url.includes("/authors/OL26320A.json")) return res(author);
      return res({}, { ok: false, status: 404 });
    };
    const item = await provider(fetchImpl).getByExternalId({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL27448W",
    });
    expect(item.year).toBe(1954);
    expect(searchCalls).toBe(0);
  });

  it("uses the exact Work-key Search year (1965) when the Work lacks a date", async () => {
    let fallbackUrl = "";
    const fetchImpl = duneRouter((url) => {
      fallbackUrl = url;
      return res({
        numFound: 1,
        docs: [{ key: DUNE_KEY, first_publish_year: 1965 }],
      });
    });
    const item = await provider(fetchImpl).getByExternalId(DUNE_REF);
    expect(item.year).toBe(1965);
    if (item.kind === "book") {
      expect(item.authors).toEqual(["Frank Herbert"]);
    }
    // Bounded, exact-key request: only key + first_publish_year, limit 1.
    const decoded = decodeURIComponent(fallbackUrl);
    expect(decoded).toContain('key:"/works/OL893414W"');
    expect(fallbackUrl).toContain("fields=key%2Cfirst_publish_year");
    expect(fallbackUrl).toContain("limit=1");
  });

  it("rejects a mismatched Work key and keeps failing safely (year 0)", async () => {
    const fetchImpl = duneRouter(() =>
      res({
        numFound: 1,
        docs: [{ key: "/works/OL999999W", first_publish_year: 1965 }],
      }),
    );
    const item = await provider(fetchImpl).getByExternalId(DUNE_REF);
    expect(item.year).toBe(0);
  });

  it("rejects a missing/implausible fallback year (year 0)", async () => {
    const missing = duneRouter(() =>
      res({ numFound: 1, docs: [{ key: DUNE_KEY }] }),
    );
    expect((await provider(missing).getByExternalId(DUNE_REF)).year).toBe(0);

    const implausible = duneRouter(() =>
      res({ numFound: 1, docs: [{ key: DUNE_KEY, first_publish_year: 1400 }] }),
    );
    expect((await provider(implausible).getByExternalId(DUNE_REF)).year).toBe(
      0,
    );
  });

  it("rejects empty, multiple, or doc-less Search responses (year 0)", async () => {
    const empty = duneRouter(() => res({ numFound: 0, docs: [] }));
    expect((await provider(empty).getByExternalId(DUNE_REF)).year).toBe(0);

    const docless = duneRouter(() => res({}));
    expect((await provider(docless).getByExternalId(DUNE_REF)).year).toBe(0);

    const multiple = duneRouter(() =>
      res({
        numFound: 2,
        docs: [
          { key: DUNE_KEY, first_publish_year: 1965 },
          { key: "/works/OL111W", first_publish_year: 1999 },
        ],
      }),
    );
    expect((await provider(multiple).getByExternalId(DUNE_REF)).year).toBe(0);
  });

  it("fails safely when the fallback Search is rate-limited, unavailable, or times out", async () => {
    const rateLimited = duneRouter(() => res({}, { ok: false, status: 429 }));
    await expect(
      provider(rateLimited).getByExternalId(DUNE_REF),
    ).rejects.toMatchObject({ category: "rate_limited" });

    const unavailable = duneRouter(() => res({}, { ok: false, status: 503 }));
    await expect(
      provider(unavailable).getByExternalId(DUNE_REF),
    ).rejects.toMatchObject({ category: "unavailable" });

    const timeout = duneRouter(() => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    });
    await expect(
      provider(timeout).getByExternalId(DUNE_REF),
    ).rejects.toMatchObject({ category: "timeout" });
  });

  it("never leaks the query, Work id, title, URL, or payload into structured logs", async () => {
    const events: CatalogLogEvent[] = [];
    const sink: CatalogLogSink = (event) => events.push(event);
    const configured = createOpenLibraryProvider({
      contact: "dev@example.com",
      fetchImpl: duneRouter(() =>
        res({
          numFound: 1,
          docs: [{ key: DUNE_KEY, first_publish_year: 1965 }],
        }),
      ),
      retryEnv,
      logSink: sink,
    });
    await configured.getByExternalId(DUNE_REF);

    expect(events.length).toBeGreaterThan(0);
    const allowedKeys = new Set([
      "event",
      "schemaVersion",
      "provider",
      "operation",
      "outcome",
      "latencyBucket",
      "retries",
      "errorCategory",
      "fake",
    ]);
    for (const event of events) {
      for (const key of Object.keys(event)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain("OL893414W");
      expect(serialized).not.toContain("Dune");
      expect(serialized).not.toContain("Frank Herbert");
      expect(serialized).not.toContain("search.json");
      expect(serialized).not.toContain("first_publish");
      expect(serialized).not.toContain("key:");
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
