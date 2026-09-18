// Favalog Catalog Platform — unit tests for the bounded refresh worker core.
//
// These tests exercise the drift- and safety-critical logic offline: argument
// parsing, the fail-closed provider-activation gate, freshness-cutoff math,
// LOCAL-vs-REMOTE authorization reuse, outcome classification (changed /
// unchanged / removed / transient / non-transient / stale), bounded batches and
// resumable remaining-due accounting, dry-run write-freedom, and overlap
// short-circuiting. No network, no database.

import { describe, expect, it } from "vitest";

import { NORMALIZATION_VERSION } from "../lib/catalog/config.ts";
import { providerError } from "../lib/catalog/errors.ts";
import type { ProviderErrorCategory } from "../lib/catalog/errors.ts";
import type { ProviderRegistry } from "../lib/catalog/provider-registry";
import type {
  ExternalProvider,
  NormalizedMediaItem,
} from "../lib/catalog/types";
import type { MediaKind } from "../lib/types.ts";
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_FRESHNESS_DAYS,
  DEFAULT_LIMIT,
  MAX_CONCURRENCY,
  MAX_FRESHNESS_DAYS,
  MAX_LIMIT,
  computeCutoffIso,
  isContentChanged,
  parseArgs,
  providerActivation,
  providerNativeId,
  runRefreshCatalog,
  type Logger,
  type RefreshCandidateRow,
  type RefreshDeps,
  type RefreshStore,
  type RpcEnvelope,
} from "./refresh-catalog-core.ts";

// --- Fixtures ---------------------------------------------------------------

/** A quiet logger that records lines for assertions. */
function makeLogger(): Logger & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    log: (m) => lines.push(m),
    warn: (m) => lines.push(m),
    error: (m) => errors.push(m),
  };
}

/** A minimal normalized movie item for a given TMDB numeric id. */
function movieItem(
  externalId: string,
  overrides: Partial<NormalizedMediaItem> = {},
): NormalizedMediaItem {
  return {
    ref: { provider: "tmdb", externalId },
    kind: "movie",
    title: `Movie ${externalId}`,
    subtitle: undefined,
    synopsis: "A synopsis.",
    year: 2001,
    genres: ["Drama"],
    posterUrl: undefined,
    backdropUrl: undefined,
    averageRating: undefined,
    runtimeMinutes: 100,
    director: "Someone",
    cast: ["A", "B"],
    ...overrides,
  } as NormalizedMediaItem;
}

type GetResult = NormalizedMediaItem | ProviderErrorCategory;

/** A fake provider registry whose getByExternalId is table-driven by raw id. */
function fakeRegistry(
  responses: Record<string, GetResult>,
  onCall?: (rawId: string) => void,
): ProviderRegistry {
  const provider = {
    id: "tmdb" as ExternalProvider,
    search: async () => ({ page: 1, totalPages: 1, results: [] }),
    getByExternalId: async (ref: { externalId: string }) => {
      onCall?.(ref.externalId);
      const result = responses[ref.externalId];
      if (result === undefined) {
        throw providerError({
          provider: "tmdb",
          operation: "getByExternalId",
          category: "not_found",
        });
      }
      if (typeof result === "string") {
        throw providerError({
          provider: "tmdb",
          operation: "getByExternalId",
          category: result,
        });
      }
      return result;
    },
  };
  return {
    get: () => provider as never,
    has: () => true,
    ids: () => ["tmdb"],
  };
}

interface FakeStoreOptions {
  rows: RefreshCandidateRow[];
  due?: number;
  lockAcquired?: boolean;
  /** Per-external-id refresh RPC result; defaults to a "changed" success. */
  refreshResult?: (args: Record<string, unknown>) => RpcEnvelope;
}

interface RecordingStore extends RefreshStore {
  calls: {
    refresh: Record<string, unknown>[];
    markFailed: Record<string, unknown>[];
    markRemoved: Record<string, unknown>[];
    lockAcquired: number;
    lockReleased: number;
  };
}

function fakeStore(options: FakeStoreOptions): RecordingStore {
  const calls = {
    refresh: [] as Record<string, unknown>[],
    markFailed: [] as Record<string, unknown>[],
    markRemoved: [] as Record<string, unknown>[],
    lockAcquired: 0,
    lockReleased: 0,
  };
  const due = options.due ?? options.rows.length;
  return {
    calls,
    async acquireRunLock() {
      calls.lockAcquired += 1;
      return options.lockAcquired ?? true;
    },
    async releaseRunLock() {
      calls.lockReleased += 1;
    },
    async countDue() {
      return due;
    },
    async selectDue({ limit }) {
      return options.rows.slice(0, limit);
    },
    async refresh(args) {
      calls.refresh.push(args);
      return (
        options.refreshResult?.(args) ?? {
          data: { outcome: "changed", changed: true },
          error: null,
        }
      );
    },
    async markFailed(args) {
      calls.markFailed.push(args);
      return { data: { outcome: "transient_failure" }, error: null };
    },
    async markRemoved(args) {
      calls.markRemoved.push(args);
      return { data: { outcome: "removed" }, error: null };
    },
  };
}

/** A row for TMDB movie `id`, with an optional stale baseline content hash. */
function row(
  id: string,
  contentHash: string | null = "old",
): RefreshCandidateRow {
  return {
    mediaId: `media-${id}`,
    slug: `movie-${id}`,
    source: "tmdb",
    kind: "movie" as MediaKind,
    externalId: `movie:${id}`,
    contentHash,
    normalizationVersion: NORMALIZATION_VERSION,
  };
}

/** A fully-activated local TMDB env (enabled + configured + local Supabase). */
function liveEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    EXTERNAL_CATALOG_ENABLED: "true",
    TMDB_ENABLED: "true",
    TMDB_API_READ_TOKEN: "token-present",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: "service-key",
    ...overrides,
  };
}

function deps(
  env: Record<string, string | undefined>,
  registry: ProviderRegistry,
  store: RefreshStore,
  logger: Logger,
  nowMs = Date.UTC(2026, 0, 30),
): RefreshDeps {
  return {
    env,
    buildRegistry: () => registry,
    createStore: () => store,
    now: () => nowMs,
    logger,
  };
}

// --- parseArgs --------------------------------------------------------------

describe("parseArgs", () => {
  it("applies documented defaults", () => {
    const parsed = parseArgs([]);
    expect(parsed).toEqual({
      ok: true,
      args: {
        provider: "tmdb",
        limit: DEFAULT_LIMIT,
        concurrency: DEFAULT_CONCURRENCY,
        freshnessDays: DEFAULT_FRESHNESS_DAYS,
        dryRun: false,
        allowRemote: false,
        confirmProjectRef: undefined,
        json: false,
      },
    });
  });

  it("accepts both providers and rejects an unknown one", () => {
    expect(parseArgs(["--provider", "openlibrary"])).toMatchObject({
      ok: true,
      args: { provider: "openlibrary" },
    });
    expect(parseArgs(["--provider", "netflix"])).toMatchObject({ ok: false });
  });

  it("parses bounded numeric options in both forms", () => {
    expect(
      parseArgs(["--limit=10", "--concurrency", "2", "--freshness-days=3"]),
    ).toMatchObject({
      ok: true,
      args: { limit: 10, concurrency: 2, freshnessDays: 3 },
    });
  });

  it("rejects out-of-range or non-integer numeric options (fail-closed)", () => {
    expect(parseArgs([`--limit=${MAX_LIMIT + 1}`])).toMatchObject({
      ok: false,
    });
    expect(parseArgs([`--concurrency=${MAX_CONCURRENCY + 1}`])).toMatchObject({
      ok: false,
    });
    expect(
      parseArgs([`--freshness-days=${MAX_FRESHNESS_DAYS + 1}`]),
    ).toMatchObject({ ok: false });
    expect(parseArgs(["--limit=0"])).toMatchObject({ ok: false });
    expect(parseArgs(["--limit=-1"])).toMatchObject({ ok: false });
    expect(parseArgs(["--limit=1.5"])).toMatchObject({ ok: false });
  });

  it("rejects unknown flags, missing values, empty ref, and duplicates", () => {
    expect(parseArgs(["--dryrun"])).toMatchObject({ ok: false });
    expect(parseArgs(["--limit"])).toMatchObject({ ok: false });
    expect(parseArgs(["--confirm-project-ref="])).toMatchObject({ ok: false });
    expect(parseArgs(["--dry-run", "--dry-run"])).toMatchObject({ ok: false });
    expect(parseArgs(["--limit", "1", "--limit", "2"])).toMatchObject({
      ok: false,
    });
  });

  it("parses the remote-safety and json flags", () => {
    expect(
      parseArgs(["--allow-remote", "--confirm-project-ref=abcd", "--json"]),
    ).toMatchObject({
      ok: true,
      args: { allowRemote: true, confirmProjectRef: "abcd", json: true },
    });
  });
});

// --- pure helpers -----------------------------------------------------------

describe("providerActivation", () => {
  it("defaults TMDB OFF and requires the global switch + flag + token", () => {
    expect(providerActivation({}, "tmdb")).toEqual({
      enabled: false,
      configured: false,
    });
    expect(
      providerActivation(
        { EXTERNAL_CATALOG_ENABLED: "true", TMDB_ENABLED: "true" },
        "tmdb",
      ),
    ).toEqual({ enabled: true, configured: false });
    expect(
      providerActivation(
        {
          EXTERNAL_CATALOG_ENABLED: "true",
          TMDB_ENABLED: "true",
          TMDB_API_READ_TOKEN: "x",
        },
        "tmdb",
      ),
    ).toEqual({ enabled: true, configured: true });
  });

  it("keeps TMDB disabled when only the provider flag is on (global off)", () => {
    expect(providerActivation({ TMDB_ENABLED: "true" }, "tmdb")).toEqual({
      enabled: false,
      configured: false,
    });
  });

  it("defaults Open Library ON under the global switch and reads its email", () => {
    expect(
      providerActivation({ EXTERNAL_CATALOG_ENABLED: "true" }, "openlibrary"),
    ).toEqual({ enabled: true, configured: false });
    expect(
      providerActivation(
        {
          EXTERNAL_CATALOG_ENABLED: "1",
          OPEN_LIBRARY_CONTACT_EMAIL: "ops@example.com",
        },
        "openlibrary",
      ),
    ).toEqual({ enabled: true, configured: true });
    expect(
      providerActivation(
        { EXTERNAL_CATALOG_ENABLED: "true", OPEN_LIBRARY_ENABLED: "false" },
        "openlibrary",
      ),
    ).toMatchObject({ enabled: false });
  });
});

describe("computeCutoffIso", () => {
  it("subtracts exactly freshnessDays from now", () => {
    const now = Date.UTC(2026, 0, 30);
    expect(computeCutoffIso(now, 7)).toBe(
      new Date(Date.UTC(2026, 0, 23)).toISOString(),
    );
  });
});

describe("providerNativeId", () => {
  it("strips the kind prefix for TMDB and leaves Open Library ids raw", () => {
    expect(providerNativeId("tmdb", "movie", "movie:603")).toBe("603");
    expect(providerNativeId("tmdb", "tv", "tv:1399")).toBe("1399");
    expect(providerNativeId("openlibrary", "book", "OL45804W")).toBe(
      "OL45804W",
    );
  });
});

describe("isContentChanged", () => {
  it("flags a hash difference or a normalization-version difference", () => {
    const base = row("1", "hash-a");
    expect(isContentChanged(base, "hash-a")).toBe(false);
    expect(isContentChanged(base, "hash-b")).toBe(true);
    expect(
      isContentChanged({ ...base, normalizationVersion: "v0" }, "hash-a"),
    ).toBe(true);
  });
});

// --- runRefreshCatalog: gates & guards --------------------------------------

describe("runRefreshCatalog activation gate", () => {
  it("is a clean no-op (exit 0) when the provider is disabled — no requests", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1")] });
    let called = false;
    const registry = fakeRegistry({}, () => {
      called = true;
    });
    const code = await runRefreshCatalog([], deps({}, registry, store, logger));
    expect(code).toBe(0);
    expect(called).toBe(false);
    expect(store.calls.refresh).toHaveLength(0);
    expect(logger.lines.join("\n")).toContain("disabled");
  });

  it("aborts (exit 1) when the provider is enabled but unconfigured — no requests", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1")] });
    let called = false;
    const registry = fakeRegistry({}, () => {
      called = true;
    });
    const env = liveEnv({ TMDB_API_READ_TOKEN: undefined });
    const code = await runRefreshCatalog(
      [],
      deps(env, registry, store, logger),
    );
    expect(code).toBe(1);
    expect(called).toBe(false);
    expect(logger.errors.join("\n")).toContain("not configured");
  });

  it("aborts (exit 1) when Supabase config is missing", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1")] });
    const registry = fakeRegistry({});
    const env = liveEnv({
      SUPABASE_URL: undefined,
      SUPABASE_SECRET_KEY: undefined,
    });
    const code = await runRefreshCatalog(
      [],
      deps(env, registry, store, logger),
    );
    expect(code).toBe(1);
    expect(logger.errors.join("\n")).toContain("Missing Supabase config");
  });

  it("refuses a live REMOTE run without the explicit remote confirmation flags", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1")] });
    const registry = fakeRegistry({ "603": movieItem("603") });
    const env = liveEnv({ SUPABASE_URL: "https://abcdefgh.supabase.co" });
    const code = await runRefreshCatalog(
      [],
      deps(env, registry, store, logger),
    );
    expect(code).toBe(1);
    expect(store.calls.refresh).toHaveLength(0);
    expect(logger.errors.join("\n")).toContain("remote");
  });

  it("short-circuits (exit 0) when another run holds the lock", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1")], lockAcquired: false });
    const registry = fakeRegistry({ "1": movieItem("1") });
    const code = await runRefreshCatalog(
      [],
      deps(liveEnv(), registry, store, logger),
    );
    expect(code).toBe(0);
    expect(store.calls.refresh).toHaveLength(0);
    expect(logger.lines.join("\n")).toContain("holds the lock");
  });
});

// --- runRefreshCatalog: outcomes --------------------------------------------

describe("runRefreshCatalog outcomes", () => {
  it("classifies changed, unchanged, removed, transient, non-transient, and stale", async () => {
    const logger = makeLogger();
    const rows = [
      row("1"), // changed
      row("2"), // unchanged
      row("3"), // removed (provider not_found)
      row("4"), // transient (unavailable)
      row("5"), // non-transient (unauthorized)
      row("6"), // stale (P0005)
    ];
    const registry = fakeRegistry({
      "1": movieItem("1"),
      "2": movieItem("2"),
      // "3" omitted -> not_found -> removal
      "4": "unavailable",
      "5": "unauthorized",
      "6": movieItem("6"),
    });
    const store = fakeStore({
      rows,
      refreshResult: (args) => {
        const ext = args.p_external_id;
        if (ext === "movie:2") {
          return {
            data: { outcome: "unchanged", changed: false },
            error: null,
          };
        }
        if (ext === "movie:6") {
          return { data: null, error: { message: "stale", code: "P0005" } };
        }
        return { data: { outcome: "changed", changed: true }, error: null };
      },
    });

    const code = await runRefreshCatalog(
      ["--concurrency", "1"],
      deps(liveEnv(), registry, store, logger),
    );

    // Two rows had recordable failures (transient + non-transient) -> exit 2.
    expect(code).toBe(2);
    expect(store.calls.refresh.map((a) => a.p_external_id)).toEqual([
      "movie:1",
      "movie:2",
      "movie:6",
    ]);
    expect(store.calls.markRemoved.map((a) => a.p_external_id)).toEqual([
      "movie:3",
    ]);
    expect(store.calls.markFailed.map((a) => a.p_external_id)).toEqual([
      "movie:4",
      "movie:5",
    ]);

    const report = JSON.parse(
      logger.lines.find((l) => l.includes("refresh_catalog_report")) ?? "{}",
    );
    expect(report).toMatchObject({
      due: 6,
      processed: 6,
      checked: 3, // changed + unchanged + removed
      changed: 1,
      unchanged: 1,
      removed: 1,
      unavailable: 1,
      failed: 1,
      stale: 1,
      remainingDue: 2, // 6 due - (3 checked + 1 stale) left the window
    });
  });

  it("passes the stored content hash as the optimistic-concurrency baseline", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1", "baseline-hash")] });
    const registry = fakeRegistry({ "1": movieItem("1") });
    await runRefreshCatalog([], deps(liveEnv(), registry, store, logger));
    expect(store.calls.refresh[0]).toMatchObject({
      p_expected_content_hash: "baseline-hash",
      p_normalization_version: NORMALIZATION_VERSION,
      p_source: "tmdb",
      p_external_id: "movie:1",
    });
  });

  it("records a malformed provider payload as a failure, never a removal", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1")] });
    const registry = fakeRegistry({
      "1": movieItem("1", { title: "   " }), // blank title -> not materializable
    });
    const code = await runRefreshCatalog(
      [],
      deps(liveEnv(), registry, store, logger),
    );
    expect(code).toBe(2);
    expect(store.calls.markRemoved).toHaveLength(0);
    expect(store.calls.markFailed[0]).toMatchObject({ p_error: "validation" });
  });

  it("aborts the whole run (exit 1) when the provider reports not_configured", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("1"), row("2")] });
    const registry = fakeRegistry({
      "1": "not_configured",
      "2": "not_configured",
    });
    const code = await runRefreshCatalog(
      ["--concurrency", "1"],
      deps(liveEnv(), registry, store, logger),
    );
    expect(code).toBe(1);
    expect(store.calls.refresh).toHaveLength(0);
    expect(logger.errors.join("\n")).toContain("not configured");
  });

  it("succeeds (exit 0) and reports remaining due for a bounded, resumable batch", async () => {
    const logger = makeLogger();
    const rows = [row("1"), row("2")];
    const store = fakeStore({ rows, due: 10 });
    const registry = fakeRegistry({ "1": movieItem("1"), "2": movieItem("2") });
    const code = await runRefreshCatalog(
      ["--limit", "2"],
      deps(liveEnv(), registry, store, logger),
    );
    expect(code).toBe(0);
    const report = JSON.parse(
      logger.lines.find((l) => l.includes("refresh_catalog_report")) ?? "{}",
    );
    expect(report).toMatchObject({
      due: 10,
      processed: 2,
      changed: 2,
      remainingDue: 8,
    });
  });
});

// --- runRefreshCatalog: dry run ---------------------------------------------

describe("runRefreshCatalog dry run", () => {
  it("makes read-only provider requests but performs no writes and takes no lock", async () => {
    const logger = makeLogger();
    const fetched: string[] = [];
    const rows = [row("1", "old"), row("2", null)];
    const store = fakeStore({ rows });
    const registry = fakeRegistry(
      { "1": movieItem("1"), "2": movieItem("2") },
      (id) => fetched.push(id),
    );
    const code = await runRefreshCatalog(
      ["--dry-run"],
      deps(liveEnv(), registry, store, logger),
    );
    expect(code).toBe(0);
    expect(fetched.sort()).toEqual(["1", "2"]); // provider WAS read
    expect(store.calls.refresh).toHaveLength(0); // but nothing written
    expect(store.calls.markFailed).toHaveLength(0);
    expect(store.calls.markRemoved).toHaveLength(0);
    expect(store.calls.lockAcquired).toBe(0); // no lock for a read-only run
    const report = JSON.parse(
      logger.lines.find((l) => l.includes("refresh_catalog_report")) ?? "{}",
    );
    expect(report).toMatchObject({ dryRun: true, changed: 2 });
  });

  it("previews a removal for a provider not_found without writing", async () => {
    const logger = makeLogger();
    const store = fakeStore({ rows: [row("9")] });
    const registry = fakeRegistry({}); // any id -> not_found
    const code = await runRefreshCatalog(
      ["--dry-run"],
      deps(liveEnv(), registry, store, logger),
    );
    expect(code).toBe(0);
    expect(store.calls.markRemoved).toHaveLength(0);
    const report = JSON.parse(
      logger.lines.find((l) => l.includes("refresh_catalog_report")) ?? "{}",
    );
    expect(report).toMatchObject({ dryRun: true, removed: 1 });
  });
});
