import { beforeEach, describe, expect, it, vi } from "vitest";

const isSupabaseConfigured = vi.fn();
vi.mock("./env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

const createClient = vi.fn();
vi.mock("./server", () => ({
  createClient: () => createClient(),
}));

import { resolveExternalRefs } from "./external-resolution";

/**
 * Build a fake Supabase client whose `.from(table)` returns a thenable query
 * builder resolving to the rows configured per table. Records the `.in(...)`
 * values so tests can assert only the unresolved keys are looked up in the
 * second query.
 */
function fakeClient(byTable: {
  media_external_ids?: Array<{
    external_id: string;
    media_items: { slug: string } | null;
  }>;
  media_items?: Array<{ external_id: string; slug: string }>;
}) {
  const inCalls: Record<string, string[][]> = {};
  return {
    inCalls,
    client: {
      from(table: string) {
        const rows =
          table === "media_external_ids"
            ? (byTable.media_external_ids ?? [])
            : (byTable.media_items ?? []);
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          in: (_col: string, values: string[]) => {
            (inCalls[table] ??= []).push(values);
            return builder;
          },
          then: (resolve: (r: { data: unknown; error: null }) => void) =>
            resolve({ data: rows, error: null }),
        };
        return builder;
      },
    },
  };
}

describe("resolveExternalRefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
  });

  it("returns an empty map when Supabase is unconfigured (fail-safe importable)", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    const map = await resolveExternalRefs("tmdb", [
      { kind: "movie", externalId: "693134" },
    ]);
    expect(map.size).toBe(0);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns an empty map for no candidates", async () => {
    const map = await resolveExternalRefs("tmdb", []);
    expect(map.size).toBe(0);
  });

  it("resolves an exact provider-link alias to the canonical slug (kind-qualified for TMDB)", async () => {
    const { client } = fakeClient({
      media_external_ids: [
        { external_id: "movie:693134", media_items: { slug: "dune-part-two" } },
      ],
    });
    createClient.mockResolvedValue(client);

    const map = await resolveExternalRefs("tmdb", [
      { kind: "movie", externalId: "693134" },
    ]);
    expect(map.get("movie:693134")).toBe("dune-part-two");
  });

  it("falls back to an unaliased provider row and only queries the unresolved keys", async () => {
    const { client, inCalls } = fakeClient({
      media_external_ids: [
        { external_id: "movie:1", media_items: { slug: "aliased" } },
      ],
      media_items: [{ external_id: "movie:2", slug: "row-only" }],
    });
    createClient.mockResolvedValue(client);

    const map = await resolveExternalRefs("tmdb", [
      { kind: "movie", externalId: "1" },
      { kind: "movie", externalId: "2" },
    ]);

    expect(map.get("movie:1")).toBe("aliased");
    expect(map.get("movie:2")).toBe("row-only");
    // The media_items query must only look up the still-unresolved key.
    expect(inCalls.media_items?.[0]).toEqual(["movie:2"]);
  });

  it("leaves a never-imported candidate unresolved (importable)", async () => {
    const { client } = fakeClient({});
    createClient.mockResolvedValue(client);

    const map = await resolveExternalRefs("openlibrary", [
      { kind: "book", externalId: "OL45804W" },
    ]);
    expect(map.has("OL45804W")).toBe(false);
  });
});
