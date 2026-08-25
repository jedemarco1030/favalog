import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmbeddingError } from "@/lib/search/embedding-errors";
import { SEMANTIC_MAX_COSINE_DISTANCE } from "@/lib/search/config";
import {
  FakeEmbeddingProvider,
  type EmbeddingProvider,
} from "@/lib/search/embedding-provider";
import { searchCatalog, type SearchDeps } from "./search";
import type { SearchRpcRow } from "./search-view-model";

function makeRow(overrides: Partial<SearchRpcRow> = {}): SearchRpcRow {
  return {
    media_id: "id-1",
    slug: "afterglow",
    kind: "movie",
    title: "Afterglow",
    subtitle: "",
    synopsis: "A luminous drama.",
    year: 2024,
    poster_url: "/media/posters/afterglow.svg",
    backdrop_url: "/media/backdrops/afterglow.svg",
    average_rating: 4.2,
    genres: ["Drama"],
    details: {},
    rank: 0.9,
    ...overrides,
  };
}

/** Distinct canned rows so tests can tell which arm produced the result. */
const KEYWORD_ROWS: SearchRpcRow[] = [
  makeRow({ media_id: "kw-1", slug: "keyword-hit", title: "Keyword Hit" }),
];
const HYBRID_ROWS: SearchRpcRow[] = [
  makeRow({ media_id: "hy-1", slug: "hybrid-hit", title: "Hybrid Hit" }),
];

interface FakeRpcResult {
  data: SearchRpcRow[] | null;
  error: { message?: string } | null;
}

interface FakeCountResult {
  data: number | null;
  error: { message?: string } | null;
}

/** Build a fake Supabase client returning per-function canned results. */
function makeClient(
  results: {
    keyword?: FakeRpcResult;
    hybrid?: FakeRpcResult;
    /** Compatible-corpus count (defaults to a positive, compatible corpus). */
    compatibleCount?: FakeCountResult;
  } = {},
) {
  const rpc = vi.fn(
    async (
      ...args: [fn: string, params: Record<string, unknown>]
    ): Promise<FakeRpcResult | FakeCountResult> => {
      const [fn] = args;
      if (fn === "compatible_embedding_count") {
        return results.compatibleCount ?? { data: 3, error: null };
      }
      if (fn === "hybrid_search") {
        return results.hybrid ?? { data: HYBRID_ROWS, error: null };
      }
      return results.keyword ?? { data: KEYWORD_ROWS, error: null };
    },
  );
  return { rpc };
}

/** An increasing monotonic clock so latency measurements stay non-negative. */
function makeClock(): () => number {
  let t = 0;
  return () => (t += 1);
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

describe("searchCatalog", () => {
  it("returns empty for a whitespace-only query without touching the client or provider", async () => {
    const client = makeClient();
    const createProvider = vi.fn();
    const deps: SearchDeps = {
      getClient: async () => client,
      createProvider,
      log: vi.fn(),
      now: makeClock(),
    };

    const outcome = await searchCatalog({ query: "   " }, deps);

    expect(outcome.status).toBe("empty");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("returns unavailable when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const client = makeClient();
    const outcome = await searchCatalog(
      { query: "afterglow" },
      { getClient: async () => client, log: vi.fn(), now: makeClock() },
    );

    expect(outcome.status).toBe("unavailable");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("runs keyword-only when semantic is not attempted", async () => {
    const client = makeClient();
    const log = vi.fn();
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => false,
        log,
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("keyword");
    expect(outcome.items.map((i) => i.slug)).toEqual(["keyword-hit"]);

    // The log carries the mode and a query length, never the query text.
    const logged = log.mock.calls[0][0];
    expect(logged.mode).toBe("keyword");
    expect(logged.queryLength).toBe("afterglow".length);
    expect(logged).not.toHaveProperty("query");
  });

  it("upgrades to hybrid when semantic is attempted and the provider succeeds", async () => {
    const client = makeClient();
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => true,
        createProvider: () => ({
          ok: true,
          provider: new FakeEmbeddingProvider(),
        }),
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("hybrid");
    expect(outcome.items.map((i) => i.slug)).toEqual(["hybrid-hit"]);

    // The hybrid RPC was called with a serialized string embedding AND the
    // server-supplied expected provenance (never client input).
    const hybridCall = client.rpc.mock.calls.find(
      ([fn]) => fn === "hybrid_search",
    );
    expect(hybridCall).toBeDefined();
    const args = hybridCall![1];
    expect(typeof args.p_query_embedding).toBe("string");
    expect(args.p_provider).toBe("openai");
    expect(args.p_model).toBe("text-embedding-3-small");
    expect(args.p_dimensions).toBe(512);
    expect(args.p_document_version).toBe("v1");
    // The server-controlled semantic relevance cutoff is always applied so
    // irrelevant nearest-neighbours are filtered out before fusion.
    expect(args.p_max_distance).toBe(SEMANTIC_MAX_COSINE_DISTANCE);
  });

  it("stays keyword-only (no embedding) when no compatible corpus exists", async () => {
    const client = makeClient({ compatibleCount: { data: 0, error: null } });
    const createProvider = vi.fn();
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => true,
        createProvider,
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("keyword_fallback");
    expect(outcome.fallbackReason).toBe("incompatible_corpus");
    expect(outcome.items.map((i) => i.slug)).toEqual(["keyword-hit"]);

    // No query embedding was paid for, and the hybrid RPC was never called.
    expect(createProvider).not.toHaveBeenCalled();
    expect(client.rpc.mock.calls.some(([fn]) => fn === "hybrid_search")).toBe(
      false,
    );
  });

  it("falls back to keyword when the compatible-corpus count errors", async () => {
    const client = makeClient({
      compatibleCount: { data: null, error: { message: "boom" } },
    });
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => true,
        createProvider: () => ({
          ok: true,
          provider: new FakeEmbeddingProvider(),
        }),
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("keyword_fallback");
    expect(outcome.fallbackReason).toBe("database");
    expect(client.rpc.mock.calls.some(([fn]) => fn === "hybrid_search")).toBe(
      false,
    );
  });

  it("falls back to keyword on an embedding timeout", async () => {
    const timeoutProvider: EmbeddingProvider = {
      id: "fake",
      model: "fake-model",
      dimensions: 512,
      embed: async () => {
        throw Object.assign(new Error("t"), { name: "TimeoutError" });
      },
    };
    const client = makeClient();
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => true,
        createProvider: () => ({ ok: true, provider: timeoutProvider }),
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("keyword_fallback");
    expect(outcome.fallbackReason).toBe("timeout");
    expect(outcome.items.map((i) => i.slug)).toEqual(["keyword-hit"]);
  });

  it("falls back to keyword on a transient provider error", async () => {
    const failingProvider: EmbeddingProvider = {
      id: "fake",
      model: "fake-model",
      dimensions: 512,
      embed: async () => {
        throw new EmbeddingError("transient", "x");
      },
    };
    const client = makeClient();
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => true,
        createProvider: () => ({ ok: true, provider: failingProvider }),
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("keyword_fallback");
    expect(outcome.fallbackReason).toBe("transient");
    expect(outcome.items.map((i) => i.slug)).toEqual(["keyword-hit"]);
  });

  it("falls back to keyword when the hybrid RPC errors", async () => {
    const client = makeClient({
      hybrid: { data: null, error: { message: "boom" } },
    });
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => true,
        createProvider: () => ({
          ok: true,
          provider: new FakeEmbeddingProvider(),
        }),
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    expect(outcome.mode).toBe("keyword_fallback");
    expect(outcome.fallbackReason).toBe("database");
    expect(outcome.items.map((i) => i.slug)).toEqual(["keyword-hit"]);
  });

  it("returns a database error when the keyword RPC errors", async () => {
    const client = makeClient({
      keyword: { data: null, error: { message: "kaput" } },
    });
    const outcome = await searchCatalog(
      { query: "afterglow" },
      {
        getClient: async () => client,
        attemptSemantic: () => false,
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("error");
    if (outcome.status !== "error") throw new Error("expected error");
    expect(outcome.category).toBe("database");
  });

  it("clamps an oversized limit to the server ceiling", async () => {
    const client = makeClient();
    await searchCatalog(
      { query: "afterglow", limit: 9999 },
      {
        getClient: async () => client,
        attemptSemantic: () => false,
        log: vi.fn(),
        now: makeClock(),
      },
    );

    const keywordCall = client.rpc.mock.calls.find(
      ([fn]) => fn === "keyword_search",
    );
    const args = keywordCall![1];
    expect(args.p_limit as number).toBeLessThanOrEqual(50);
  });

  it("maps rows into proper MediaItems", async () => {
    const client = makeClient({
      keyword: {
        data: [
          makeRow({
            media_id: "book-id",
            slug: "field-notes",
            kind: "book",
            details: { authors: ["Devon Halle"], pageCount: 200 },
          }),
        ],
        error: null,
      },
    });
    const outcome = await searchCatalog(
      { query: "field notes" },
      {
        getClient: async () => client,
        attemptSemantic: () => false,
        log: vi.fn(),
        now: makeClock(),
      },
    );

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("expected ok");
    const [item] = outcome.items;
    expect(item.kind).toBe("book");
    expect(item.slug).toBe("field-notes");
  });
});
