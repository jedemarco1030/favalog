import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../http";
import type { CatalogLogSink } from "../log";
import type { RetryEnvironment } from "../reliability";
import { createTmdbProvider } from "./client";
import movieDetail from "./__fixtures__/movie-detail.json";
import movieDetailIncomplete from "./__fixtures__/movie-detail-incomplete.json";
import searchMovie from "./__fixtures__/search-movie.json";
import searchTv from "./__fixtures__/search-tv.json";
import tvDetail from "./__fixtures__/tv-detail.json";

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
  if (url.includes("/search/movie")) return res(searchMovie);
  if (url.includes("/search/tv")) return res(searchTv);
  if (url.includes("/movie/603")) return res(movieDetail);
  if (url.includes("/movie/700")) return res(movieDetailIncomplete);
  if (url.includes("/tv/1399")) return res(tvDetail);
  return res({}, { ok: false, status: 404 });
};

function provider(fetchImpl: FetchLike = router) {
  return createTmdbProvider({
    token: "test-token",
    fetchImpl,
    retryEnv,
    logSink,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TMDB provider search", () => {
  it("returns movie candidates and filters junk rows", async () => {
    const page = await provider().search({ query: "matrix", kind: "movie" });
    expect(page.items.map((c) => c.ref.externalId)).toEqual(["603", "604"]);
    expect(page.items.every((c) => c.kind === "movie")).toBe(true);
    expect(page.hasMore).toBe(true); // page 1 of 3
  });

  it("returns tv candidates with the tv kind", async () => {
    const page = await provider().search({ query: "thrones", kind: "tv" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].kind).toBe("tv");
    expect(page.items[0].ref.externalId).toBe("1399");
  });

  it("merges movie + tv for an 'all' search", async () => {
    const page = await provider().search({ query: "matrix", kind: "all" });
    const kinds = new Set(page.items.map((c) => c.kind));
    expect(kinds.has("movie")).toBe(true);
    expect(kinds.has("tv")).toBe(true);
  });
});

describe("TMDB provider getByExternalId", () => {
  it("normalizes a movie with director, ordered cast, and safe image URLs", async () => {
    const item = await provider().getByExternalId({
      provider: "tmdb",
      kind: "movie",
      externalId: "603",
    });
    expect(item.kind).toBe("movie");
    expect(item.title).toBe("The Matrix");
    expect(item.year).toBe(1999);
    if (item.kind === "movie") {
      expect(item.director).toBe("Lana Wachowski");
      expect(item.cast[0]).toBe("Keanu Reeves");
      expect(item.runtimeMinutes).toBe(136);
    }
    expect(item.posterUrl).toBe(
      "https://image.tmdb.org/t/p/w500/poster603.jpg",
    );
    expect(item.averageRating).toBeGreaterThan(0);
    expect(item.averageRating).toBeLessThanOrEqual(5);
  });

  it("normalizes a tv series with mapped status and creators", async () => {
    const item = await provider().getByExternalId({
      provider: "tmdb",
      kind: "tv",
      externalId: "1399",
    });
    expect(item.kind).toBe("tv");
    if (item.kind === "tv") {
      expect(item.status).toBe("ended");
      expect(item.seasons).toBe(8);
      expect(item.creators).toEqual(["David Benioff", "D. B. Weiss"]);
    }
  });

  it("degrades gracefully for incomplete metadata (no images/cast)", async () => {
    const item = await provider().getByExternalId({
      provider: "tmdb",
      kind: "movie",
      externalId: "700",
    });
    expect(item.posterUrl).toBeUndefined();
    expect(item.backdropUrl).toBeUndefined();
    if (item.kind === "movie") {
      expect(item.cast).toEqual([]);
      expect(item.director).toBe("");
    }
  });

  it("maps a 404 detail to a not_found provider error", async () => {
    await expect(
      provider().getByExternalId({
        provider: "tmdb",
        kind: "movie",
        externalId: "999",
      }),
    ).rejects.toMatchObject({ category: "not_found" });
  });
});

describe("TMDB provider configuration", () => {
  it("fails closed with not_configured when no token is available", async () => {
    vi.stubEnv("TMDB_API_READ_TOKEN", "");
    const unconfigured = createTmdbProvider({
      fetchImpl: router,
      retryEnv,
      logSink,
    });
    await expect(
      unconfigured.search({ query: "matrix" }),
    ).rejects.toMatchObject({
      category: "not_configured",
    });
  });
});
