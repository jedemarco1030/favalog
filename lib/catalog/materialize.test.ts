import { describe, expect, it, vi } from "vitest";

import { createFakeProvider, DEFAULT_FAKE_ITEMS } from "./fake-provider";
import {
  buildDetails,
  createCatalogMaterializer,
  type CatalogRpcClient,
} from "./materialize";
import { createProviderRegistry } from "./provider-registry";
import type { NormalizedMediaItem } from "./types";

function registry() {
  return createProviderRegistry([
    createFakeProvider({ id: "tmdb" }),
    createFakeProvider({ id: "openlibrary" }),
  ]);
}

/** A fake RPC that records args and echoes a deterministic identity result. */
function recordingRpc(): {
  client: CatalogRpcClient;
  calls: Array<Record<string, unknown>>;
} {
  const calls: Array<Record<string, unknown>> = [];
  const client: CatalogRpcClient = {
    async rpc(_fn, args) {
      calls.push(args);
      return {
        data: {
          media_id: "00000000-0000-0000-0000-000000000001",
          slug: String(args.p_title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-"),
          source: args.p_source,
          external_id: args.p_external_id,
          kind: args.p_kind,
          inserted: true,
          synced_at: "2026-08-30T00:00:00.000Z",
        },
        error: null,
      };
    },
  };
  return { client, calls };
}

describe("createCatalogMaterializer", () => {
  it("materializes a movie and returns identifier-only result", async () => {
    const { client } = recordingRpc();
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    const result = await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    expect(result.source).toBe("tmdb");
    expect(result.kind).toBe("movie");
    expect(result.externalId).toBe("1001");
    expect(result.slug).toBe("fixture-movie-one");
    expect(result.inserted).toBe(true);
  });

  it("kind-qualifies the TMDB DB external_id and sends valid provenance", async () => {
    const { client, calls } = recordingRpc();
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    const args = calls[0];
    expect(args.p_external_id).toBe("movie:1001");
    expect(args.p_normalization_version).toBe("v1");
    expect(String(args.p_content_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(args.p_source).toBe("tmdb");
  });

  it("is deterministic: repeated materialization sends identical args (idempotent)", async () => {
    const { client, calls } = recordingRpc();
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    expect(calls[0]).toEqual(calls[1]);
  });

  it("uses the Open Library Work id as-is (not kind-qualified)", async () => {
    const { client, calls } = recordingRpc();
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await m.materialize({
      provider: "openlibrary",
      kind: "book",
      externalId: "OL1001W",
    });
    expect(calls[0].p_external_id).toBe("OL1001W");
  });

  it("rejects an invalid identity before any RPC call", async () => {
    const rpc = vi.fn();
    const client: CatalogRpcClient = { rpc };
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await expect(
      m.materialize({ provider: "tmdb", kind: "book", externalId: "1" }),
    ).rejects.toMatchObject({ category: "validation" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a database write error to an unavailable provider error", async () => {
    const client: CatalogRpcClient = {
      async rpc() {
        return { data: null, error: { message: "boom" } };
      },
    };
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await expect(
      m.materialize({ provider: "tmdb", kind: "movie", externalId: "1001" }),
    ).rejects.toMatchObject({ category: "unavailable" });
  });

  it("treats a malformed success contract (no media_id) as failure", async () => {
    const client: CatalogRpcClient = {
      async rpc() {
        return { data: { slug: "x" }, error: null };
      },
    };
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await expect(
      m.materialize({ provider: "tmdb", kind: "movie", externalId: "1001" }),
    ).rejects.toMatchObject({ category: "unknown" });
  });

  it("rejects a normalized record with an implausible year", async () => {
    const badItem: NormalizedMediaItem = {
      ref: { provider: "tmdb", kind: "movie", externalId: "5" },
      kind: "movie",
      title: "No Year",
      synopsis: "",
      year: 0,
      genres: [],
      runtimeMinutes: 0,
      director: "",
      cast: [],
    };
    const reg = createProviderRegistry([
      createFakeProvider({ id: "tmdb", items: [badItem] }),
    ]);
    const { client } = recordingRpc();
    const m = createCatalogMaterializer({ registry: reg, rpcClient: client });
    await expect(
      m.materialize({ provider: "tmdb", kind: "movie", externalId: "5" }),
    ).rejects.toMatchObject({ category: "validation" });
  });
});

describe("createCatalogMaterializer canonical resolution (v1B)", () => {
  /** A fake RPC that records the function name it was called with. */
  function fnCapturingRpc(resolution?: string): {
    client: CatalogRpcClient;
    fns: string[];
  } {
    const fns: string[] = [];
    const client: CatalogRpcClient = {
      async rpc(fn, args) {
        fns.push(fn);
        return {
          data: {
            media_id: "00000000-0000-0000-0000-000000000001",
            slug: "fixture-movie-one",
            source: args.p_source,
            external_id: args.p_external_id,
            kind: args.p_kind,
            inserted: resolution === "created",
            synced_at: "2026-08-30T00:00:00.000Z",
            ...(resolution ? { resolution } : {}),
          },
          error: null,
        };
      },
    };
    return { client, fns };
  }

  it("defaults to the canonically-resolving materialize_external_media RPC", async () => {
    const { client, fns } = fnCapturingRpc("created");
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    expect(fns[0]).toBe("materialize_external_media");
  });

  it("surfaces the canonical resolution outcome", async () => {
    const { client } = fnCapturingRpc("linked");
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
    });
    const result = await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    expect(result.resolution).toBe("linked");
  });

  it("omits resolution when the write path does not report one (legacy v1A RPC)", async () => {
    const { client, fns } = fnCapturingRpc();
    const m = createCatalogMaterializer({
      registry: registry(),
      rpcClient: client,
      rpcFunction: "materialize_media_item",
    });
    const result = await m.materialize({
      provider: "tmdb",
      kind: "movie",
      externalId: "1001",
    });
    expect(fns[0]).toBe("materialize_media_item");
    expect(result.resolution).toBeUndefined();
  });
});

describe("buildDetails", () => {
  it("builds kind-specific detail payloads", () => {
    const [movie, tv, book] = DEFAULT_FAKE_ITEMS;
    expect(buildDetails(movie)).toHaveProperty("director");
    expect(buildDetails(tv)).toHaveProperty("seasons");
    expect(buildDetails(book)).toHaveProperty("authors");
  });
});
