import { describe, expect, it } from "vitest";

import { createFakeProvider } from "../lib/catalog/fake-provider.ts";
import { createProviderRegistry } from "../lib/catalog/provider-registry.ts";
import {
  parseArgs,
  runCatalogCli,
  type CatalogCliDeps,
  type CliSupabaseLike,
} from "./catalog-import-core.ts";

const LOCAL_URL = "http://127.0.0.1:54321";
const REMOTE_URL = "https://abcdifghjklmnopqrst.supabase.co";

function fakeRegistry() {
  return createProviderRegistry([
    createFakeProvider({ id: "tmdb" }),
    createFakeProvider({ id: "openlibrary" }),
  ]);
}

function makeDeps(
  env: Record<string, string | undefined>,
  rpc?: CliSupabaseLike["rpc"],
): {
  deps: CatalogCliDeps;
  logs: string[];
  errors: string[];
  rpcCalls: number;
} {
  const logs: string[] = [];
  const errors: string[] = [];
  let rpcCalls = 0;
  const client: CliSupabaseLike = {
    rpc:
      rpc ??
      (async () => {
        rpcCalls += 1;
        return {
          data: {
            media_id: "00000000-0000-0000-0000-000000000001",
            slug: "fixture-movie-one",
            source: "tmdb",
            external_id: "movie:1001",
            kind: "movie",
            inserted: true,
            synced_at: "2026-08-30T00:00:00.000Z",
          },
          error: null,
        };
      }),
  };
  const deps: CatalogCliDeps = {
    env,
    buildRegistry: () => fakeRegistry(),
    createSupabaseClient: () => ({
      rpc: async (fn, args) => client.rpc(fn, args),
    }),
    logger: {
      log: (m) => logs.push(m),
      warn: (m) => logs.push(m),
      error: (m) => errors.push(m),
    },
  };
  return {
    deps,
    logs,
    errors,
    get rpcCalls() {
      return rpcCalls;
    },
  } as {
    deps: CatalogCliDeps;
    logs: string[];
    errors: string[];
    rpcCalls: number;
  };
}

describe("parseArgs", () => {
  it("rejects a missing or unknown command", () => {
    expect(parseArgs([])).toEqual({ ok: false, error: expect.any(String) });
    expect(parseArgs(["frobnicate"]).ok).toBe(false);
  });

  it("rejects unknown, duplicated, and value-less flags", () => {
    expect(parseArgs(["search", "--nope"]).ok).toBe(false);
    expect(parseArgs(["search", "--fake", "--fake"]).ok).toBe(false);
    expect(parseArgs(["search", "--provider"]).ok).toBe(false);
    expect(parseArgs(["import", "--page", "abc"]).ok).toBe(false);
    expect(parseArgs(["import", "--confirm-project-ref="]).ok).toBe(false);
  });

  it("accepts a valid import invocation", () => {
    const parsed = parseArgs([
      "import",
      "--provider",
      "tmdb",
      "--kind",
      "movie",
      "--external-id",
      "1001",
      "--allow-remote",
      "--confirm-project-ref=abcd",
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.args.command).toBe("import");
      expect(parsed.args.allowRemote).toBe(true);
      expect(parsed.args.confirmProjectRef).toBe("abcd");
    }
  });
});

describe("runCatalogCli — read-only commands", () => {
  it("runs a fake search with exit 0 and no writes", async () => {
    const h = makeDeps({});
    const code = await runCatalogCli(
      ["search", "--provider", "tmdb", "--query", "fixture", "--fake"],
      h.deps,
    );
    expect(code).toBe(0);
  });

  it("inspects one fake item read-only", async () => {
    const h = makeDeps({});
    const code = await runCatalogCli(
      [
        "inspect",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
        "--fake",
      ],
      h.deps,
    );
    expect(code).toBe(0);
  });
});

describe("runCatalogCli — import guard matrix", () => {
  it("dry-run needs no Supabase config and never writes", async () => {
    const h = makeDeps({});
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
        "--fake",
        "--dry-run",
      ],
      h.deps,
    );
    expect(code).toBe(0);
    expect(h.rpcCalls).toBe(0);
  });

  it("performs a local write against a local target", async () => {
    const h = makeDeps({ SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: "k" });
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
        "--fake",
      ],
      h.deps,
    );
    expect(code).toBe(0);
    expect(h.rpcCalls).toBe(1);
  });

  it("rejects a remote --fake write outright", async () => {
    const h = makeDeps({ SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: "k" });
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
        "--fake",
      ],
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.rpcCalls).toBe(0);
  });

  it("rejects a remote live write without --allow-remote", async () => {
    const h = makeDeps({ SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: "k" });
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
      ],
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.rpcCalls).toBe(0);
  });

  it("rejects a remote live write with a mismatched project ref", async () => {
    const h = makeDeps({ SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: "k" });
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
        "--allow-remote",
        "--confirm-project-ref=wrong",
      ],
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.rpcCalls).toBe(0);
  });

  it("allows a remote live write with matching allow-remote + confirm-project-ref", async () => {
    const h = makeDeps({ SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: "k" });
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
        "--allow-remote",
        "--confirm-project-ref=abcdifghjklmnopqrst",
      ],
      h.deps,
    );
    expect(code).toBe(0);
    expect(h.rpcCalls).toBe(1);
  });

  it("fails when Supabase config is missing for a live import", async () => {
    const h = makeDeps({});
    const code = await runCatalogCli(
      [
        "import",
        "--provider",
        "tmdb",
        "--kind",
        "movie",
        "--external-id",
        "1001",
      ],
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.rpcCalls).toBe(0);
  });
});
