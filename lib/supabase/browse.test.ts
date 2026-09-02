import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  browseCatalog,
  type BrowseDeps,
  type BrowseTableClient,
} from "./browse";
import type { MediaItemRow } from "./mappers";
import type { BrowseLogFields } from "@/lib/browse/log";

function makeRow(
  i: number,
  overrides: Partial<MediaItemRow> = {},
): MediaItemRow {
  return {
    id: `id-${String(i).padStart(3, "0")}`,
    kind: "movie",
    source: "favalog",
    external_id: `ext-${i}`,
    slug: `slug-${i}`,
    title: `Title ${i}`,
    subtitle: null,
    synopsis: "A synopsis.",
    year: 2000 + i,
    poster_url: null,
    backdrop_url: null,
    average_rating: null,
    genres: ["Drama"],
    details: {},
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z",
    content_hash: null,
    normalization_version: null,
    synced_at: null,
    search_tsv: null as unknown as MediaItemRow["search_tsv"],
    ...overrides,
  };
}

/**
 * A fake {@link BrowseTableClient} backed by an in-memory catalog. It mimics the
 * database: media-type + genre filtering, an exact count, and range slicing.
 * Ordering is the adapter's responsibility, so the fake simply records the sort
 * it was asked for (tests assert it is forwarded correctly).
 */
type DbErr = { message?: string } | null;
type GenresResult = { data: Array<{ genres: string[] }> | null; error: DbErr };
type PageResult = {
  data: MediaItemRow[] | null;
  count: number | null;
  error: DbErr;
};

function makeClient(allRows: MediaItemRow[]) {
  const fetchGenres = vi.fn(
    async (kind: "movie" | "tv" | "book" | null): Promise<GenresResult> => ({
      data: allRows
        .filter((r) => kind === null || r.kind === kind)
        .map((r) => ({ genres: r.genres })),
      error: null,
    }),
  );

  const fetchPage = vi.fn(
    async (input: {
      kind: "movie" | "tv" | "book" | null;
      genre: string | null;
      sort: string;
      from: number;
      to: number;
    }): Promise<PageResult> => {
      const filtered = allRows.filter(
        (r) =>
          (input.kind === null || r.kind === input.kind) &&
          (input.genre === null || r.genres.includes(input.genre)),
      );
      return {
        data: filtered.slice(input.from, input.to + 1),
        count: filtered.length,
        error: null,
      };
    },
  );

  return { fetchGenres, fetchPage };
}

function makeDeps(
  client: BrowseTableClient,
  log: (fields: BrowseLogFields) => void = () => {},
): BrowseDeps {
  let t = 0;
  return { getClient: async () => client, now: () => (t += 1), log };
}

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_KEY;
  }
  vi.restoreAllMocks();
});

describe("browseCatalog", () => {
  it("reports unavailable (and logs it) when Supabase is unconfigured, without touching the client", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const client = makeClient([makeRow(1)]);
    const log = vi.fn();

    const outcome = await browseCatalog({}, makeDeps(client, log));

    expect(outcome).toEqual({ status: "unavailable" });
    expect(client.fetchGenres).not.toHaveBeenCalled();
    expect(client.fetchPage).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatchObject({ outcome: "unavailable" });
  });

  it("returns an error (never mock data) when the page read fails", async () => {
    const client = makeClient([makeRow(1)]);
    client.fetchPage.mockResolvedValueOnce({
      data: null,
      count: null,
      error: { message: "boom" },
    });
    const log = vi.fn();

    const outcome = await browseCatalog({}, makeDeps(client, log));

    expect(outcome).toEqual({ status: "error", category: "database" });
    expect(log.mock.calls[0]?.[0]).toMatchObject({ outcome: "error" });
  });

  it("returns an error when the genre read fails", async () => {
    const client = makeClient([makeRow(1)]);
    client.fetchGenres.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    const outcome = await browseCatalog({}, makeDeps(client));
    expect(outcome).toEqual({ status: "error", category: "database" });
  });

  it("returns a deterministic first page with correct pagination metadata", async () => {
    const rows = Array.from({ length: 29 }, (_, i) => makeRow(i + 1));
    const client = makeClient(rows);

    const outcome = await browseCatalog({}, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.items).toHaveLength(24); // BROWSE_PAGE_SIZE
    expect(outcome.pagination).toMatchObject({
      page: 1,
      pageSize: 24,
      totalCount: 29,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    });
    // The first page begins at offset 0.
    expect(client.fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ from: 0, to: 23 }),
    );
  });

  it("clamps an out-of-range page down to the last real page and re-fetches", async () => {
    const rows = Array.from({ length: 29 }, (_, i) => makeRow(i + 1));
    const client = makeClient(rows);

    const outcome = await browseCatalog({ page: "99" }, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.pagination.page).toBe(2);
    expect(outcome.pagination.hasNext).toBe(false);
    expect(outcome.pagination.hasPrev).toBe(true);
    expect(outcome.items).toHaveLength(5); // 29 - 24
    expect(client.fetchPage).toHaveBeenCalledTimes(2); // initial + clamped refetch
  });

  it("forwards each allow-listed sort and defaults an unknown one", async () => {
    const client = makeClient([makeRow(1)]);
    await browseCatalog({ sort: "title_asc" }, makeDeps(client));
    expect(client.fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "title_asc" }),
    );

    await browseCatalog({ sort: "not-a-sort" }, makeDeps(client));
    expect(client.fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "recently_added" }),
    );
  });

  it("exposes distinct, sorted available genres and reconciles a requested genre case-insensitively", async () => {
    const rows = [
      makeRow(1, { genres: ["Drama", "Sci-Fi"] }),
      makeRow(2, { genres: ["drama", "Comedy"] }),
    ];
    const client = makeClient(rows);

    const outcome = await browseCatalog({ genre: "sci-fi" }, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    // Distinct (case-insensitive), alphabetical, canonical stored casing.
    expect(outcome.availableGenres).toEqual(["Comedy", "Drama", "Sci-Fi"]);
    // "sci-fi" reconciles to the canonical "Sci-Fi" and is applied.
    expect(outcome.appliedGenre).toBe("Sci-Fi");
    expect(client.fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ genre: "Sci-Fi" }),
    );
  });

  it("never lets polluted historical subjects reach the Genre dropdown", async () => {
    // A malformed/legacy book row still holding raw Open Library subjects
    // (query-like syntax, entities, dates, bestseller/list + award metadata,
    // prose) alongside one genuine canonical genre.
    const rows = [
      makeRow(1, {
        kind: "book",
        genres: [
          "award:nebula_award=novel",
          "nyt:mass-market-monthly=2021-11-07",
          "Dune (Imaginary place)",
          "Fiction, science fiction, general",
          "Accessible book",
          "1979",
          "Science Fiction", // the only real product genre
        ],
      }),
    ];
    const client = makeClient(rows);

    const outcome = await browseCatalog({ kind: "book" }, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    // Only the canonical product genre survives; every polluted value is dropped.
    expect(outcome.availableGenres).toEqual(["Science Fiction"]);
  });

  it("drops an unknown/incompatible genre safely (no filter applied)", async () => {
    const rows = [makeRow(1, { genres: ["Drama"] })];
    const client = makeClient(rows);

    const outcome = await browseCatalog({ genre: "Western" }, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.appliedGenre).toBeNull();
    expect(client.fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ genre: null }),
    );
  });

  it("normalizes an unknown media type to all", async () => {
    const rows = [makeRow(1, { kind: "movie" }), makeRow(2, { kind: "book" })];
    const client = makeClient(rows);

    const outcome = await browseCatalog({ kind: "bogus" }, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.kind).toBe("all");
    expect(client.fetchGenres).toHaveBeenCalledWith(null);
    expect(client.fetchPage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: null }),
    );
  });

  it("narrows by an allow-listed media type", async () => {
    const rows = [
      makeRow(1, { kind: "movie" }),
      makeRow(2, { kind: "book" }),
      makeRow(3, { kind: "book" }),
    ];
    const client = makeClient(rows);

    const outcome = await browseCatalog({ kind: "book" }, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.kind).toBe("book");
    expect(outcome.pagination.totalCount).toBe(2);
    expect(outcome.items.every((item) => item.kind === "book")).toBe(true);
  });

  it("emits redaction-safe telemetry for a successful browse", async () => {
    const rows = [makeRow(1, { genres: ["Drama"] })];
    const client = makeClient(rows);
    const log = vi.fn();

    await browseCatalog(
      { genre: "Drama", sort: "newest" },
      makeDeps(client, log),
    );

    expect(log).toHaveBeenCalledTimes(1);
    const fields = log.mock.calls[0]?.[0] as BrowseLogFields;
    expect(fields).toMatchObject({
      outcome: "ok",
      sort: "newest",
      mediaType: "all",
      genreFiltered: true,
      page: 1,
    });
    // Never the raw genre text / titles.
    const serialized = JSON.stringify(fields);
    expect(serialized).not.toContain("Drama");
    expect(serialized).not.toContain("Title 1");
  });

  it("returns an empty page (not an error) for an empty catalog", async () => {
    const client = makeClient([]);
    const outcome = await browseCatalog({}, makeDeps(client));

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.items).toEqual([]);
    expect(outcome.pagination).toMatchObject({
      totalCount: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
  });
});
