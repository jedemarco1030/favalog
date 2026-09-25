import { afterEach, describe, expect, it, vi } from "vitest";

import { CatalogProviderError } from "../errors";
import type { FetchLike } from "../http";
import type { CatalogLogEvent, CatalogLogSink } from "../log";
import type { RetryEnvironment } from "../reliability";
import { createRawgProvider } from "./client";
import detail from "./__fixtures__/game-detail.json";
import search from "./__fixtures__/search.json";

const retryEnv: RetryEnvironment = { sleep: async () => {}, random: () => 0 };
const logSink: CatalogLogSink = () => {};
const API_KEY = "rawg-test-key-123";

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
  if (url.includes("/games?")) return res(search);
  if (url.includes("/games/3328?")) return res(detail);
  if (url.includes("/games/4200?")) return res(detail); // id mismatch
  return res({}, { ok: false, status: 404 });
};

function provider(
  fetchImpl: FetchLike = router,
  extra: { apiKey?: string; logSink?: CatalogLogSink } = {},
) {
  return createRawgProvider({
    apiKey: "apiKey" in extra ? extra.apiKey : API_KEY,
    fetchImpl,
    retryEnv,
    logSink: extra.logSink ?? logSink,
  });
}

async function categoryOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CatalogProviderError) return error.category;
    throw error;
  }
  throw new Error("expected a provider error");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("RAWG provider search", () => {
  it("returns game candidates and reports more pages from `next`", async () => {
    const page = await provider().search({ query: "witcher", kind: "game" });
    expect(page.items.map((c) => c.ref.externalId)).toEqual([
      "3328",
      "10035",
      "777001",
    ]);
    expect(page.items.every((c) => c.ref.provider === "rawg")).toBe(true);
    expect(page.hasMore).toBe(true);
  });

  it("sends the key, precise search, and bounded paging as query params", async () => {
    const seen: string[] = [];
    const spy: FetchLike = async (url, init) => {
      seen.push(url);
      return router(url, init);
    };
    await provider(spy).search({ query: "  hades ", page: 2 });
    const url = new URL(seen[0]);
    expect(url.pathname).toBe("/api/games");
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(url.searchParams.get("search")).toBe("hades");
    expect(url.searchParams.get("search_precise")).toBe("true");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe("25");
  });

  it.each(["movie", "tv", "book"] as const)(
    "returns nothing for a %s-only filter without a network call",
    async (kind) => {
      const fetchImpl = vi.fn<FetchLike>();
      const page = await provider(fetchImpl).search({ query: "x", kind });
      expect(page.items).toEqual([]);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("fails closed with not_configured when no key is set", async () => {
    vi.stubEnv("RAWG_API_KEY", "");
    const fetchImpl = vi.fn<FetchLike>();
    const category = await categoryOf(
      provider(fetchImpl, { apiKey: undefined }).search({ query: "hades" }),
    );
    expect(category).toBe("not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a blank query as a validation error", async () => {
    expect(await categoryOf(provider().search({ query: "   " }))).toBe(
      "validation",
    );
  });

  it("never puts the API key into logs", async () => {
    const events: CatalogLogEvent[] = [];
    await provider(router, {
      logSink: (event) => events.push(event),
    }).search({ query: "witcher" });
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain(API_KEY);
  });
});

describe("RAWG provider getByExternalId", () => {
  it("re-fetches and normalizes the trusted detail record", async () => {
    const item = await provider().getByExternalId({
      provider: "rawg",
      kind: "game",
      externalId: "3328",
    });
    expect(item.kind).toBe("game");
    expect(item.title).toBe("The Witcher 3: Wild Hunt");
    expect(item.year).toBe(2015);
  });

  it.each([
    { provider: "tmdb", kind: "game", externalId: "3328" },
    { provider: "rawg", kind: "movie", externalId: "3328" },
    { provider: "rawg", kind: "game", externalId: "../users" },
    { provider: "rawg", kind: "game", externalId: "0" },
    { provider: "rawg", kind: "game", externalId: "12abc" },
  ] as const)("rejects an invalid ref %o before fetching", async (ref) => {
    const fetchImpl = vi.fn<FetchLike>();
    expect(await categoryOf(provider(fetchImpl).getByExternalId(ref))).toBe(
      "validation",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a 404 to not_found", async () => {
    expect(
      await categoryOf(
        provider().getByExternalId({
          provider: "rawg",
          kind: "game",
          externalId: "999",
        }),
      ),
    ).toBe("not_found");
  });

  it("refuses a record whose id differs from the requested one", async () => {
    expect(
      await categoryOf(
        provider().getByExternalId({
          provider: "rawg",
          kind: "game",
          externalId: "4200",
        }),
      ),
    ).toBe("not_found");
  });
});
