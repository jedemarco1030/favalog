import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

import { interleave, mergeByReleaseDate, pickDiscoveryFeatured } from "./merge";
import {
  normalizeOpenLibraryTrending,
  normalizeRawgShelf,
  normalizeTmdbShelf,
  pageOf,
  rawgShelfUrl,
  tmdbShelfUrl,
} from "./providers";
import { getDiscoveryShelf, type CacheWrapper } from "./service";
import {
  DISCOVERY_SHELVES,
  parseDiscoveryPage,
  parseDiscoverySort,
  shelfFor,
} from "./shelves";
import type { DiscoveryCandidate } from "./types";
import {
  formatReleaseDate,
  parseReleaseDate,
  recentWindow,
  upcomingWindow,
} from "./windows";

const NOW = new Date("2026-09-27T12:00:00Z");
const passThrough: CacheWrapper = (fn) => fn();

function candidate(
  id: string,
  over: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  return {
    ref: { provider: "tmdb", kind: "movie", externalId: id },
    kind: "movie",
    title: `Title ${id}`,
    rank: 1,
    ...over,
  };
}

describe("release-date windows", () => {
  it("accepts only real calendar dates", () => {
    expect(parseReleaseDate("2026-10-30")).toBe("2026-10-30");
    expect(parseReleaseDate("2026-02-30")).toBeUndefined();
    expect(parseReleaseDate("2026")).toBeUndefined();
    expect(parseReleaseDate("")).toBeUndefined();
    expect(parseReleaseDate(null)).toBeUndefined();
  });

  it("builds recent and upcoming windows in UTC days", () => {
    expect(recentWindow(NOW)).toEqual({ from: "2026-08-13", to: "2026-09-27" });
    expect(upcomingWindow(NOW)).toEqual({
      from: "2026-09-28",
      to: "2027-09-27",
    });
  });

  it("formats dates without timezone drift", () => {
    expect(formatReleaseDate("2026-10-01")).toBe("Oct 1, 2026");
  });
});

describe("shelf definitions", () => {
  it("resolves supported kind/sort pairs only", () => {
    expect(shelfFor("movie", "upcoming")?.id).toBe("movie-upcoming");
    expect(shelfFor("book", "upcoming")).toBeNull();
    expect(shelfFor("tv", "upcoming")).toBeNull();
  });

  it("validates URL sort and page", () => {
    expect(parseDiscoverySort("game", "top-rated")).toBe("top-rated");
    expect(parseDiscoverySort("game", "trending")).toBe("popular");
    expect(parseDiscoverySort("book", undefined)).toBe("trending");
    const def = DISCOVERY_SHELVES["movie-popular"];
    expect(parseDiscoveryPage("3", def)).toBe(3);
    expect(parseDiscoveryPage("99", def)).toBe(def.maxPages);
    expect(parseDiscoveryPage("-1", def)).toBe(1);
    expect(parseDiscoveryPage("abc", def)).toBe(1);
  });

  it("describes every shelf's ordering in plain language", () => {
    for (const def of Object.values(DISCOVERY_SHELVES)) {
      expect(def.description.length).toBeGreaterThan(10);
    }
  });
});

describe("TMDB shelves", () => {
  it("requests provider-side ordering and date windows", () => {
    const upcoming = new URL(
      tmdbShelfUrl(DISCOVERY_SHELVES["movie-upcoming"], 2, NOW),
    );
    expect(upcoming.pathname).toMatch(/\/discover\/movie$/);
    expect(upcoming.searchParams.get("sort_by")).toBe("popularity.desc");
    expect(upcoming.searchParams.get("primary_release_date.gte")).toBe(
      "2026-09-28",
    );
    expect(upcoming.searchParams.get("page")).toBe("2");

    const top = new URL(
      tmdbShelfUrl(DISCOVERY_SHELVES["tv-top-rated"], 1, NOW),
    );
    expect(top.searchParams.get("sort_by")).toBe("vote_average.desc");
    expect(top.searchParams.get("vote_count.gte")).toBe("300");

    const trending = new URL(
      tmdbShelfUrl(DISCOVERY_SHELVES["tv-trending"], 1, NOW),
    );
    expect(trending.pathname).toMatch(/\/trending\/tv\/week$/);
  });

  it("drops rows without identity, adult rows, and out-of-window dates", () => {
    const def = DISCOVERY_SHELVES["movie-upcoming"];
    const result = normalizeTmdbShelf(
      {
        page: 1,
        total_pages: 40,
        results: [
          {
            id: 1,
            title: "Soon",
            release_date: "2026-11-01",
            poster_path: "/a.jpg",
          },
          { id: 2, title: "Undated", release_date: "" },
          { id: 3, title: "Past", release_date: "2026-01-01" },
          { title: "No id", release_date: "2026-11-02" },
          { id: 4, title: "Adult", adult: true, release_date: "2026-11-03" },
          { id: 1, title: "Soon duplicate", release_date: "2026-11-01" },
        ],
      },
      def,
      1,
      NOW,
    );
    expect(result.candidates.map((c) => c.title)).toEqual(["Soon"]);
    expect(result.candidates[0]).toMatchObject({
      ref: { provider: "tmdb", kind: "movie", externalId: "1" },
      releaseDate: "2026-11-01",
      year: 2026,
      rank: 1,
    });
    expect(result.candidates[0].posterUrl).toContain("/a.jpg");
    expect(result.hasMore).toBe(true);
  });

  it("keeps provider rank across pages and stops at the page cap", () => {
    const def = DISCOVERY_SHELVES["tv-popular"];
    const result = normalizeTmdbShelf(
      {
        total_pages: 100,
        results: [{ id: 9, name: "Show", first_air_date: "2020-01-01" }],
      },
      def,
      def.maxPages,
      NOW,
    );
    expect(result.candidates[0].rank).toBe(
      (def.maxPages - 1) * def.pageSize + 1,
    );
    expect(result.hasMore).toBe(false);
  });
});

describe("RAWG shelves", () => {
  it("orders by Metascore and requires one for top-rated", () => {
    const url = new URL(
      rawgShelfUrl(DISCOVERY_SHELVES["game-top-rated"], 1, NOW, "k"),
    );
    expect(url.searchParams.get("ordering")).toBe("-metacritic");
    expect(url.searchParams.get("metacritic")).toBe("1,100");
    const upcoming = new URL(
      rawgShelfUrl(DISCOVERY_SHELVES["game-upcoming"], 1, NOW, "k"),
    );
    expect(upcoming.searchParams.get("dates")).toBe("2026-09-28,2027-09-27");
  });

  it("never treats a TBA placeholder as a confirmed date", () => {
    const result = normalizeRawgShelf(
      {
        next: "https://api.rawg.io/api/games?page=2",
        results: [
          {
            id: 10,
            name: "Dated",
            released: "2026-12-01",
            tba: false,
            background_image: "https://media.rawg.io/a.jpg",
          },
          { id: 11, name: "Placeholder", released: "2026-12-31", tba: true },
          { id: 12, name: "No date", released: null },
        ],
      },
      DISCOVERY_SHELVES["game-upcoming"],
      1,
      NOW,
    );
    expect(result.candidates.map((c) => c.title)).toEqual(["Dated"]);
    expect(result.candidates[0].ref).toEqual({
      provider: "rawg",
      kind: "game",
      externalId: "10",
    });
    expect(result.hasMore).toBe(true);
  });
});

describe("Open Library trending", () => {
  it("normalizes works and pages them locally from one request", () => {
    const works = Array.from({ length: 25 }, (_, i) => ({
      key: `/works/OL${i + 1}W`,
      title: `Book ${i + 1}`,
      cover_i: i === 0 ? 123 : undefined,
      first_publish_year: 2001,
    }));
    const all = normalizeOpenLibraryTrending({
      works: [...works, { title: "No key" }],
    });
    expect(all).toHaveLength(25);
    expect(all[0].ref).toEqual({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL1W",
    });
    expect(all[0].posterUrl).toContain("123");
    const def = DISCOVERY_SHELVES["book-trending"];
    expect(pageOf(all, def, 1)).toMatchObject({ hasMore: true });
    expect(pageOf(all, def, 2).candidates).toHaveLength(5);
    expect(pageOf(all, def, 2).hasMore).toBe(false);
  });
});

describe("merging across providers", () => {
  it("orders by stated release date only, never by provider score", () => {
    const tmdb = [
      candidate("a", { releaseDate: "2026-11-05", rank: 1 }),
      candidate("b", { rank: 2 }),
    ];
    const rawg = [
      candidate("g", {
        ref: { provider: "rawg", kind: "game", externalId: "g" },
        kind: "game",
        releaseDate: "2026-10-01",
        rank: 1,
      }),
    ];
    expect(
      mergeByReleaseDate([tmdb, rawg], "asc", 10).map((c) => c.ref.externalId),
    ).toEqual(["g", "a"]);
    expect(
      mergeByReleaseDate([tmdb, rawg], "desc", 1).map((c) => c.ref.externalId),
    ).toEqual(["a"]);
  });

  it("interleaves each provider's own ranking", () => {
    const out = interleave(
      [[candidate("1"), candidate("2")], [candidate("x")]],
      10,
    );
    expect(out.map((c) => c.ref.externalId)).toEqual(["1", "x", "2"]);
  });

  it("picks a stable daily featured title that has wide artwork", () => {
    const lists = [
      [
        candidate("no-art"),
        candidate("art", { backdropUrl: "https://x/y.jpg" }),
      ],
    ];
    expect(pickDiscoveryFeatured(lists, 7)?.ref.externalId).toBe("art");
    expect(pickDiscoveryFeatured([[candidate("no-art")]], 0)).toBeNull();
  });
});

describe("getDiscoveryShelf", () => {
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  it("reports disabled providers without calling them", async () => {
    const fetchImpl = vi.fn();
    const result = await getDiscoveryShelf("game-popular", 1, {
      isAvailable: () => false,
      fetchImpl,
      cache: passThrough,
    });
    expect(result).toEqual({
      status: "unavailable",
      shelfId: "game-popular",
      reason: "disabled",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a labelled page from the provider", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        total_pages: 3,
        results: [{ id: 5, title: "Film", release_date: "2026-05-01" }],
      }),
    );
    const result = await getDiscoveryShelf("movie-popular", 1, {
      isAvailable: () => true,
      fetchImpl,
      cache: passThrough,
      now: () => NOW,
      credentials: { tmdbToken: "t" },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.page).toMatchObject({
      provider: "tmdb",
      ranking: "tmdb-popularity",
      page: 1,
      hasMore: true,
    });
    expect(result.page.candidates[0].title).toBe("Film");
  });

  it("reports a provider failure instead of substituting data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getDiscoveryShelf("movie-popular", 1, {
      isAvailable: () => true,
      fetchImpl: vi.fn(async () => jsonResponse({}, 401)),
      cache: passThrough,
      credentials: { tmdbToken: "t" },
    });
    expect(result).toMatchObject({
      status: "unavailable",
      reason: "provider-error",
    });
    warn.mockRestore();
  });

  it("clamps pages to the shelf cap", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ results: [], next: null }),
    );
    const result = await getDiscoveryShelf("game-popular", 999, {
      isAvailable: () => true,
      fetchImpl,
      cache: passThrough,
      credentials: { rawgKey: "k" },
    });
    expect(result.status === "ok" && result.page.page).toBe(
      DISCOVERY_SHELVES["game-popular"].maxPages,
    );
  });
});
