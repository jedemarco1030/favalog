import { describe, expect, it, vi } from "vitest";

import { FakeEmbeddingProvider } from "../lib/search/embedding-provider.ts";
import type {
  EmbeddingRecord,
  EmbeddingStore,
  EmbeddingUpsert,
  PipelineReport,
} from "../lib/search/pipeline.ts";
import {
  authorizeEmbeddingWrite,
  classifyTarget,
  parseArgs,
  runEmbedCatalog,
  type EmbedDeps,
  type MediaRow,
  type TargetClassification,
} from "./embed-catalog-core.ts";

// ---------------------------------------------------------------------------
// Test doubles. Nothing here touches a real network or a real database.
// ---------------------------------------------------------------------------

const SAMPLE_ROW: MediaRow = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "sample-movie",
  kind: "movie",
  title: "Sample Movie",
  subtitle: null,
  synopsis: "A deterministic fixture used by the embed-catalog core tests.",
  year: 2020,
  poster_url: null,
  genres: ["Drama"],
  details: { runtimeMinutes: 100, director: "Dir", cast: ["A", "B"] },
};

const LOCAL_URL = "http://127.0.0.1:54321";
const REMOTE_HOST = "abcd1234efgh.supabase.co";
const REMOTE_REF = "abcd1234efgh";
const REMOTE_URL = `https://${REMOTE_HOST}`;
const SERVICE_KEY = "super-secret-service-role-key-value";

interface MockSupabase {
  upsertCalls: Array<{ values: Record<string, unknown>; opts: unknown }>;
  from: (table: string) => unknown;
}

function createMockSupabase(
  mediaRows: MediaRow[] = [SAMPLE_ROW],
  existing: unknown[] = [],
): MockSupabase {
  const upsertCalls: MockSupabase["upsertCalls"] = [];
  return {
    upsertCalls,
    from(table: string) {
      const result =
        table === "media_items"
          ? { data: mediaRows, error: null }
          : { data: existing, error: null };
      const thenable = {
        order: () => thenable,
        limit: () => thenable,
        then: (resolve: (value: unknown) => void) => resolve(result),
      };
      return {
        select: () => thenable,
        upsert: (values: Record<string, unknown>, opts: unknown) => {
          upsertCalls.push({ values, opts });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

interface Harness {
  deps: EmbedDeps;
  supabase: MockSupabase;
  runPipeline: ReturnType<typeof vi.fn>;
  captured: {
    store?: EmbeddingStore;
    options?: unknown;
    records?: EmbeddingRecord[];
  };
  logs: string[];
  errors: string[];
}

function createHarness(
  overrides: {
    env?: Record<string, string | undefined>;
    openAiOk?: boolean;
    failing?: boolean;
  } = {},
): Harness {
  const supabase = createMockSupabase();
  const captured: Harness["captured"] = {};
  const logs: string[] = [];
  const errors: string[] = [];

  const report: PipelineReport = {
    attempted: 1,
    updated: 0,
    unchanged: 1,
    failed: overrides.failing ? 1 : 0,
    tokens: 0,
    durationMs: 1,
  };

  const runPipeline = vi.fn(
    async (
      records: EmbeddingRecord[],
      store: EmbeddingStore,
      _provider: unknown,
      options: unknown,
    ) => {
      captured.records = records;
      captured.store = store;
      captured.options = options;
      return report;
    },
  );

  const deps: EmbedDeps = {
    env: overrides.env ?? {
      SUPABASE_URL: LOCAL_URL,
      SUPABASE_SECRET_KEY: SERVICE_KEY,
    },
    createSupabaseClient: () =>
      supabase as unknown as ReturnType<EmbedDeps["createSupabaseClient"]>,
    createFakeProvider: () => new FakeEmbeddingProvider(),
    createOpenAIProvider: () =>
      overrides.openAiOk === false
        ? { ok: false as const, reason: "no key" }
        : { ok: true as const, provider: new FakeEmbeddingProvider() },
    runPipeline: runPipeline as unknown as EmbedDeps["runPipeline"],
    logger: {
      log: (m) => logs.push(m),
      warn: (m) => logs.push(m),
      error: (m) => errors.push(m),
    },
  };

  return { deps, supabase, runPipeline, captured, logs, errors };
}

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

/** Assert a successful parse and return the parsed args. */
function okArgs(argv: string[]) {
  const result = parseArgs(argv);
  if (!result.ok) throw new Error(`expected ok parse, got: ${result.error}`);
  return result.args;
}

describe("parseArgs — supported forms", () => {
  it("defaults every flag off", () => {
    expect(okArgs([])).toEqual({
      dryRun: false,
      fake: false,
      force: false,
      limit: undefined,
      allowRemote: false,
      confirmProjectRef: undefined,
    });
  });

  it("accepts every supported boolean flag", () => {
    expect(
      okArgs(["--dry-run", "--fake", "--force", "--allow-remote"]),
    ).toEqual({
      dryRun: true,
      fake: true,
      force: true,
      limit: undefined,
      allowRemote: true,
      confirmProjectRef: undefined,
    });
  });

  it("parses the remote-safety flags in both `=` and space forms", () => {
    expect(
      okArgs(["--allow-remote", "--confirm-project-ref=ref123"]),
    ).toMatchObject({ allowRemote: true, confirmProjectRef: "ref123" });
    expect(okArgs(["--confirm-project-ref", "ref456"])).toMatchObject({
      confirmProjectRef: "ref456",
    });
  });

  it("parses --limit in both forms", () => {
    expect(okArgs(["--limit", "5"]).limit).toBe(5);
    expect(okArgs(["--limit=7"]).limit).toBe(7);
  });
});

describe("parseArgs — rejects invalid input (fail-closed)", () => {
  /** Assert the parse failed with a nonzero-worthy, secret-free error. */
  function expectRejected(argv: string[]) {
    const result = parseArgs(argv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
      expect(result.error).not.toContain(SERVICE_KEY);
    }
    return result;
  }

  it("rejects a completely unknown flag", () => {
    expectRejected(["--nope"]);
  });

  it("rejects a misspelled flag — a `--dryrun` typo is NOT --dry-run", () => {
    const result = expectRejected(["--dryrun"]);
    // Critically, it must not have been silently treated as a dry run.
    expect(result.ok).toBe(false);
  });

  it("rejects other misspellings of real flags", () => {
    expectRejected(["--drt-run"]);
    expectRejected(["--fak"]);
    expectRejected(["--allowremote"]);
    expectRejected(["--confirm_project_ref=abc"]);
  });

  it("rejects a missing --limit value (end of args)", () => {
    expectRejected(["--limit"]);
  });

  it("rejects a missing --limit value (followed by another flag)", () => {
    expectRejected(["--limit", "--fake"]);
  });

  it("rejects a missing --confirm-project-ref value (end of args)", () => {
    expectRejected(["--confirm-project-ref"]);
  });

  it("rejects a missing --confirm-project-ref value (followed by a flag)", () => {
    expectRejected(["--confirm-project-ref", "--allow-remote"]);
  });

  it("rejects invalid limits: non-integer, decimal, zero, negative", () => {
    expectRejected(["--limit", "abc"]);
    expectRejected(["--limit=abc"]);
    expectRejected(["--limit", "3.5"]);
    expectRejected(["--limit=3.5"]);
    expectRejected(["--limit", "0"]);
    expectRejected(["--limit=0"]);
    expectRejected(["--limit", "-5"]);
    expectRejected(["--limit=-5"]);
  });

  it("rejects an empty project reference in both forms", () => {
    expectRejected(["--confirm-project-ref="]);
    expectRejected(["--confirm-project-ref", "   "]);
  });

  it("rejects conflicting or ambiguous duplicate options", () => {
    expectRejected(["--fake", "--fake"]);
    expectRejected(["--limit", "5", "--limit=7"]);
    expectRejected(["--allow-remote", "--allow-remote"]);
    expectRejected(["--confirm-project-ref=a", "--confirm-project-ref=b"]);
  });
});

// ---------------------------------------------------------------------------
// classifyTarget
// ---------------------------------------------------------------------------

describe("classifyTarget", () => {
  it("classifies loopback / documented local endpoints as local", () => {
    for (const url of [
      "http://localhost:54321",
      "http://127.0.0.1:54321",
      "http://[::1]:54321",
    ]) {
      const c = classifyTarget(url);
      expect(c.kind).toBe("local");
      expect(c.projectRef).toBeUndefined();
    }
  });

  it("classifies a hosted supabase URL as remote and extracts the project ref", () => {
    const c = classifyTarget(REMOTE_URL);
    expect(c.kind).toBe("remote");
    expect(c.host).toBe(REMOTE_HOST);
    expect(c.projectRef).toBe(REMOTE_REF);
  });

  it("treats unknown hosts and unparseable URLs conservatively (no ref)", () => {
    expect(classifyTarget("https://example.com").kind).toBe("unknown");
    expect(classifyTarget("not a url").kind).toBe("unknown");
    expect(classifyTarget("https://example.com").projectRef).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// authorizeEmbeddingWrite (pure guard)
// ---------------------------------------------------------------------------

const LOCAL: TargetClassification = {
  kind: "local",
  host: "127.0.0.1",
  projectRef: undefined,
};
const REMOTE: TargetClassification = {
  kind: "remote",
  host: REMOTE_HOST,
  projectRef: REMOTE_REF,
};
const UNKNOWN: TargetClassification = {
  kind: "unknown",
  host: "example.com",
  projectRef: undefined,
};

function decide(
  classification: TargetClassification,
  opts: Partial<{
    fake: boolean;
    force: boolean;
    dryRun: boolean;
    allowRemote: boolean;
    confirmProjectRef: string | undefined;
  }> = {},
) {
  return authorizeEmbeddingWrite({
    classification,
    fake: opts.fake ?? false,
    force: opts.force ?? false,
    dryRun: opts.dryRun ?? false,
    allowRemote: opts.allowRemote ?? false,
    confirmProjectRef: opts.confirmProjectRef,
  });
}

describe("authorizeEmbeddingWrite", () => {
  it("allows local fake and local live writes", () => {
    expect(decide(LOCAL, { fake: true })).toMatchObject({
      allowed: true,
      writesPermitted: true,
    });
    expect(decide(LOCAL, {})).toMatchObject({
      allowed: true,
      writesPermitted: true,
    });
  });

  it("rejects a remote fake write — even with --force", () => {
    expect(decide(REMOTE, { fake: true })).toMatchObject({
      allowed: false,
      reason: "remote_fake_forbidden",
    });
    expect(decide(REMOTE, { fake: true, force: true })).toMatchObject({
      allowed: false,
      reason: "remote_fake_forbidden",
    });
  });

  it("rejects a remote live write without both explicit confirmations", () => {
    expect(decide(REMOTE, {})).toMatchObject({
      allowed: false,
      reason: "remote_not_allowed",
    });
    expect(decide(REMOTE, { allowRemote: true })).toMatchObject({
      allowed: false,
      reason: "remote_confirmation_missing",
    });
    expect(
      decide(REMOTE, { allowRemote: true, confirmProjectRef: "wrong-ref" }),
    ).toMatchObject({ allowed: false, reason: "remote_confirmation_mismatch" });
  });

  it("--force does not bypass remote protection", () => {
    expect(decide(REMOTE, { force: true })).toMatchObject({ allowed: false });
  });

  it("allows a fully confirmed remote live write", () => {
    expect(
      decide(REMOTE, { allowRemote: true, confirmProjectRef: REMOTE_REF }),
    ).toMatchObject({ allowed: true, reason: "remote_confirmed" });
  });

  it("never confirms an unknown-host target (no resolvable ref)", () => {
    expect(
      decide(UNKNOWN, { allowRemote: true, confirmProjectRef: "anything" }),
    ).toMatchObject({ allowed: false });
  });

  it("treats a dry run as allowed-but-write-free for every target", () => {
    for (const c of [LOCAL, REMOTE, UNKNOWN]) {
      const d = decide(c, { dryRun: true, fake: true });
      expect(d.allowed).toBe(true);
      expect(d.writesPermitted).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// runEmbedCatalog (orchestration; all collaborators mocked)
// ---------------------------------------------------------------------------

describe("runEmbedCatalog", () => {
  it("allows a LOCAL fake write and reaches the pipeline", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--fake"], h.deps);
    expect(code).toBe(0);
    expect(h.runPipeline).toHaveBeenCalledTimes(1);
  });

  it("allows a LOCAL live write and reaches the pipeline", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: true,
    });
    const code = await runEmbedCatalog([], h.deps);
    expect(code).toBe(0);
    expect(h.runPipeline).toHaveBeenCalledTimes(1);
  });

  it("rejects a REMOTE fake write before touching the pipeline or DB", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--fake"], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
    expect(h.supabase.upsertCalls).toHaveLength(0);
  });

  it("rejects a REMOTE fake write even with --force", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--fake", "--force"], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
  });

  it("rejects a REMOTE live write without confirmation", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: true,
    });
    const code = await runEmbedCatalog([], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
  });

  it("rejects a REMOTE live write with a wrong project reference", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: true,
    });
    const code = await runEmbedCatalog(
      ["--allow-remote", "--confirm-project-ref=not-the-ref"],
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
  });

  it("allows a fully confirmed REMOTE live write to reach the pipeline", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: true,
    });
    const code = await runEmbedCatalog(
      ["--allow-remote", `--confirm-project-ref=${REMOTE_REF}`],
      h.deps,
    );
    expect(code).toBe(0);
    expect(h.runPipeline).toHaveBeenCalledTimes(1);
  });

  it("performs NO writes during a dry run (store.upsert is blocked)", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--dry-run"], h.deps);
    expect(code).toBe(0);
    expect(h.runPipeline).toHaveBeenCalledTimes(1);
    expect((h.captured.options as { dryRun: boolean }).dryRun).toBe(true);

    // Even if the pipeline attempted a write, the store refuses it.
    const sampleUpsert: EmbeddingUpsert = {
      mediaId: SAMPLE_ROW.id,
      content: "x",
      contentHash: "h",
      documentVersion: "v",
      embedding: [0, 1],
      model: "m",
      provider: "p",
      dimensions: 2,
      embeddedAt: new Date(0).toISOString(),
    };
    await expect(h.captured.store!.upsert(sampleUpsert)).rejects.toThrow();
    expect(h.supabase.upsertCalls).toHaveLength(0);
  });

  it("fails when Supabase config is missing", async () => {
    const h = createHarness({ env: {} });
    const code = await runEmbedCatalog(["--fake"], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
  });

  it("never logs the service key in classification or decision output", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: true,
    });
    await runEmbedCatalog(
      ["--allow-remote", `--confirm-project-ref=${REMOTE_REF}`],
      h.deps,
    );
    const all = [...h.logs, ...h.errors].join("\n");
    expect(all).not.toContain(SERVICE_KEY);
    expect(all).toContain(REMOTE_REF); // safe project ref is logged
  });

  it("returns exit code 2 when the pipeline reports per-row failures", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      failing: true,
    });
    const code = await runEmbedCatalog(["--fake"], h.deps);
    expect(code).toBe(2);
  });

  it("rejects a `--dryrun` typo and never reaches the pipeline", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--dryrun"], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
    expect(h.supabase.upsertCalls).toHaveLength(0);
    // A safe usage message is printed; no secret leaks.
    const all = [...h.logs, ...h.errors].join("\n");
    expect(all).toContain("Unknown option");
    expect(all).not.toContain(SERVICE_KEY);
  });

  it("fails on an unknown flag even alongside valid remote authorization, before DB access", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: REMOTE_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: true,
    });
    const code = await runEmbedCatalog(
      ["--allow-remote", `--confirm-project-ref=${REMOTE_REF}`, "--bogus"],
      h.deps,
    );
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
    expect(h.supabase.upsertCalls).toHaveLength(0);
  });

  it("fails on a missing argument value (--limit with no value)", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--limit"], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
  });

  it("fails on an invalid limit", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
    });
    const code = await runEmbedCatalog(["--limit", "0"], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
  });

  it("a real run without an OpenAI key exits nonzero (never a clean no-op)", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: false,
    });
    const code = await runEmbedCatalog([], h.deps);
    expect(code).toBe(1);
    expect(h.runPipeline).not.toHaveBeenCalled();
    expect(h.supabase.upsertCalls).toHaveLength(0);
  });

  it("a dry run remains possible without an OpenAI key", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: false,
    });
    const code = await runEmbedCatalog(["--dry-run"], h.deps);
    expect(code).toBe(0);
    expect(h.runPipeline).toHaveBeenCalledTimes(1);
    expect((h.captured.options as { dryRun: boolean }).dryRun).toBe(true);
  });

  it("a fake local run remains possible without an OpenAI key", async () => {
    const h = createHarness({
      env: { SUPABASE_URL: LOCAL_URL, SUPABASE_SECRET_KEY: SERVICE_KEY },
      openAiOk: false,
    });
    const code = await runEmbedCatalog(["--fake"], h.deps);
    expect(code).toBe(0);
    expect(h.runPipeline).toHaveBeenCalledTimes(1);
  });
});
