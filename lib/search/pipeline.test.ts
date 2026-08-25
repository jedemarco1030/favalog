import { describe, expect, it } from "vitest";

import { EmbeddingError } from "@/lib/search/embedding-errors";
import {
  FakeEmbeddingProvider,
  type EmbeddingProvider,
} from "@/lib/search/embedding-provider";
import {
  chunk,
  runEmbeddingPipeline,
  selectStale,
  type EmbeddingRecord,
  type EmbeddingStore,
  type EmbeddingUpsert,
  type ExistingEmbedding,
} from "@/lib/search/pipeline";

/** An in-memory {@link EmbeddingStore} for deterministic pipeline tests. */
function makeStore(existing: Map<string, ExistingEmbedding> = new Map()): {
  store: EmbeddingStore;
  upserts: EmbeddingUpsert[];
} {
  const upserts: EmbeddingUpsert[] = [];
  const store: EmbeddingStore = {
    loadExisting: async () => existing,
    upsert: async (row) => {
      upserts.push(row);
    },
  };
  return { store, upserts };
}

function makeRecord(overrides: Partial<EmbeddingRecord> = {}): EmbeddingRecord {
  return {
    mediaId: "m1",
    slug: "afterglow",
    document: "Afterglow — a luminous drama.",
    contentHash: "hash-1",
    ...overrides,
  };
}

/** A provider that records every embed() call and delegates to a fake. */
function makeRecordingProvider(): {
  provider: EmbeddingProvider;
  calls: string[][];
} {
  const fake = new FakeEmbeddingProvider();
  const calls: string[][] = [];
  const provider: EmbeddingProvider = {
    id: fake.id,
    model: fake.model,
    dimensions: fake.dimensions,
    embed: async (texts) => {
      calls.push(texts);
      return fake.embed(texts);
    },
  };
  return { provider, calls };
}

const retry = { sleep: async () => {}, random: () => 0 };
const baseOptions = { documentVersion: "v1", retry } as const;

/** The provider identity the fake-backed runs produce (provider/model/dims). */
const FAKE = new FakeEmbeddingProvider();
const expectedIdentity = {
  provider: FAKE.id,
  model: FAKE.model,
  dimensions: FAKE.dimensions,
  documentVersion: "v1",
} as const;

/** Build an existing row that fully matches {@link expectedIdentity} by default. */
function makeExisting(
  overrides: Partial<ExistingEmbedding> = {},
): ExistingEmbedding {
  return {
    contentHash: "same",
    hasEmbedding: true,
    provider: FAKE.id,
    model: FAKE.model,
    dimensions: FAKE.dimensions,
    documentVersion: "v1",
    ...overrides,
  };
}

describe("selectStale", () => {
  it("marks a record with no existing row as stale", () => {
    const record = makeRecord({ mediaId: "m1" });
    const { toEmbed, unchanged } = selectStale(
      [record],
      new Map(),
      expectedIdentity,
    );
    expect(toEmbed).toEqual([record]);
    expect(unchanged).toEqual([]);
  });

  it("marks a record whose content hash differs as stale", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "new" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ contentHash: "old" })],
    ]);
    const { toEmbed } = selectStale([record], existing, expectedIdentity);
    expect(toEmbed).toEqual([record]);
  });

  it("marks a record whose existing row lacks an embedding as stale", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      [
        "m1",
        makeExisting({
          hasEmbedding: false,
          provider: null,
          model: null,
          dimensions: null,
          documentVersion: null,
        }),
      ],
    ]);
    const { toEmbed } = selectStale([record], existing, expectedIdentity);
    expect(toEmbed).toEqual([record]);
  });

  it("marks a fake-provider row stale when the expected provider is OpenAI", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ provider: "fake", model: "fake-model" })],
    ]);
    const { toEmbed } = selectStale([record], existing, {
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 512,
      documentVersion: "v1",
    });
    expect(toEmbed).toEqual([record]);
  });

  it("marks a record stale when only the provider differs", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ provider: "other" })],
    ]);
    const { toEmbed } = selectStale([record], existing, expectedIdentity);
    expect(toEmbed).toEqual([record]);
  });

  it("marks a record stale when only the model differs", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ model: "some-other-model" })],
    ]);
    const { toEmbed } = selectStale([record], existing, expectedIdentity);
    expect(toEmbed).toEqual([record]);
  });

  it("marks a record stale when only the dimensions differ", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ dimensions: 1536 })],
    ]);
    const { toEmbed } = selectStale([record], existing, expectedIdentity);
    expect(toEmbed).toEqual([record]);
  });

  it("marks a record stale when only the document version differs", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ documentVersion: "v0" })],
    ]);
    const { toEmbed } = selectStale([record], existing, expectedIdentity);
    expect(toEmbed).toEqual([record]);
  });

  it("treats a complete, exact identity match as unchanged", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ contentHash: "same" })],
    ]);
    const { toEmbed, unchanged } = selectStale(
      [record],
      existing,
      expectedIdentity,
    );
    expect(toEmbed).toEqual([]);
    expect(unchanged).toEqual([record]);
  });

  it("re-embeds an otherwise-fresh row when force is set", () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ contentHash: "same" })],
    ]);
    const { toEmbed, unchanged } = selectStale(
      [record],
      existing,
      expectedIdentity,
      { force: true },
    );
    expect(toEmbed).toEqual([record]);
    expect(unchanged).toEqual([]);
  });
});

describe("chunk", () => {
  it("splits into fixed-size chunks with a smaller remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when size exceeds the length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("guards a size below 1 by treating it as 1", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
    expect(chunk([1, 2], -5)).toEqual([[1], [2]]);
  });

  it("returns no chunks for an empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("runEmbeddingPipeline", () => {
  it("embeds all missing records and records provenance", async () => {
    const records = [
      makeRecord({ mediaId: "m1", slug: "a", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", slug: "b", contentHash: "h2" }),
    ];
    const { store, upserts } = makeStore();
    const provider = new FakeEmbeddingProvider();

    const report = await runEmbeddingPipeline(
      records,
      store,
      provider,
      baseOptions,
    );

    expect(report.attempted).toBe(2);
    expect(report.updated).toBe(2);
    expect(report.unchanged).toBe(0);
    expect(report.failed).toBe(0);
    expect(upserts).toHaveLength(2);
    for (const row of upserts) {
      expect(row.embedding).toHaveLength(512);
      expect(row.model).toBe(provider.model);
      expect(row.provider).toBe(provider.id);
      expect(row.dimensions).toBe(512);
      expect(row.documentVersion).toBe("v1");
      expect(typeof row.embeddedAt).toBe("string");
      expect(row.embeddedAt.length).toBeGreaterThan(0);
    }
  });

  it("skips unchanged records", async () => {
    const record = makeRecord({ mediaId: "m1", contentHash: "same" });
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ contentHash: "same" })],
    ]);
    const { store, upserts } = makeStore(existing);

    const report = await runEmbeddingPipeline(
      [record],
      store,
      new FakeEmbeddingProvider(),
      baseOptions,
    );

    expect(report.attempted).toBe(0);
    expect(report.unchanged).toBe(1);
    expect(report.updated).toBe(0);
    expect(upserts).toHaveLength(0);
  });

  it("is idempotent: a second run with identical provenance embeds nothing", async () => {
    const records = [
      makeRecord({ mediaId: "m1", slug: "a", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", slug: "b", contentHash: "h2" }),
    ];
    const provider = new FakeEmbeddingProvider();

    // First run against an empty store: everything is embedded and recorded.
    const existing = new Map<string, ExistingEmbedding>();
    const store: EmbeddingStore = {
      loadExisting: async () => existing,
      upsert: async (row) => {
        existing.set(row.mediaId, {
          contentHash: row.contentHash,
          hasEmbedding: true,
          provider: row.provider,
          model: row.model,
          dimensions: row.dimensions,
          documentVersion: row.documentVersion,
        });
      },
    };

    const first = await runEmbeddingPipeline(
      records,
      store,
      provider,
      baseOptions,
    );
    expect(first.updated).toBe(2);

    // Second identical run: same provider/model/dimensions/version/content →
    // zero embedding calls and zero writes.
    const { provider: recording, calls } = makeRecordingProvider();
    const secondUpserts: EmbeddingUpsert[] = [];
    const second = await runEmbeddingPipeline(
      records,
      {
        loadExisting: async () => existing,
        upsert: async (row) => {
          secondUpserts.push(row);
        },
      },
      recording,
      baseOptions,
    );

    expect(second.attempted).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(2);
    expect(calls).toHaveLength(0);
    expect(secondUpserts).toHaveLength(0);
  });

  it("re-embeds every row when the expected provider changes (fake → openai)", async () => {
    const records = [
      makeRecord({ mediaId: "m1", slug: "a", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", slug: "b", contentHash: "h2" }),
    ];
    // Store already holds complete FAKE-provider rows with matching content.
    const existing = new Map<string, ExistingEmbedding>([
      ["m1", makeExisting({ contentHash: "h1" })],
      ["m2", makeExisting({ contentHash: "h2" })],
    ]);
    const { store, upserts } = makeStore(existing);

    // A provider advertising the OpenAI identity marks every fake row stale.
    const openaiLike: EmbeddingProvider = {
      id: "openai",
      model: "text-embedding-3-small",
      dimensions: 512,
      embed: async (texts) => new FakeEmbeddingProvider().embed(texts),
    };

    const report = await runEmbeddingPipeline(records, store, openaiLike, {
      ...baseOptions,
    });

    expect(report.attempted).toBe(2);
    expect(report.updated).toBe(2);
    expect(upserts.every((row) => row.provider === "openai")).toBe(true);
  });

  it("accumulates token usage from the provider", async () => {
    const records = [
      makeRecord({ mediaId: "m1", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", contentHash: "h2" }),
    ];
    const { store } = makeStore();

    const report = await runEmbeddingPipeline(
      records,
      store,
      new FakeEmbeddingProvider(),
      baseOptions,
    );

    expect(report.tokens).toBeGreaterThan(0);
  });

  it("does not call the provider or upsert on a dry run, but reports the stale count", async () => {
    const records = [
      makeRecord({ mediaId: "m1", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", contentHash: "h2" }),
    ];
    const { store, upserts } = makeStore();
    const { provider, calls } = makeRecordingProvider();

    const report = await runEmbeddingPipeline(records, store, provider, {
      ...baseOptions,
      dryRun: true,
    });

    expect(calls).toHaveLength(0);
    expect(upserts).toHaveLength(0);
    expect(report.attempted).toBe(2);
    expect(report.updated).toBe(0);
  });

  it("counts every batch as failed when the provider always fails transiently, without rejecting", async () => {
    const records = [
      makeRecord({ mediaId: "m1", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", contentHash: "h2" }),
    ];
    const { store, upserts } = makeStore();
    const provider: EmbeddingProvider = {
      id: "fake",
      model: "fake-model",
      dimensions: 512,
      embed: async () => {
        throw new EmbeddingError("transient", "temporary");
      },
    };

    const report = await runEmbeddingPipeline(records, store, provider, {
      ...baseOptions,
      // Small retry ceiling so the transient failures exhaust quickly.
      retry: { ...retry, maxRetries: 1 },
    });

    expect(report.failed).toBe(report.attempted);
    expect(report.updated).toBe(0);
    expect(upserts).toHaveLength(0);
  });

  it("rejects when the provider throws a fatal auth error", async () => {
    const records = [makeRecord({ mediaId: "m1", contentHash: "h1" })];
    const { store } = makeStore();
    const provider: EmbeddingProvider = {
      id: "fake",
      model: "fake-model",
      dimensions: 512,
      embed: async () => {
        throw new EmbeddingError("auth", "rejected key");
      },
    };

    await expect(
      runEmbeddingPipeline(records, store, provider, baseOptions),
    ).rejects.toBeInstanceOf(EmbeddingError);
  });

  it("is resume-safe: a second run embeds records left failed by the first", async () => {
    const records = [
      makeRecord({ mediaId: "m1", slug: "a", contentHash: "h1" }),
      makeRecord({ mediaId: "m2", slug: "b", contentHash: "h2" }),
    ];

    // First run: provider always fails transiently -> nothing persisted.
    const existing = new Map<string, ExistingEmbedding>();
    const { store: failingStore } = makeStore(existing);
    const failingProvider: EmbeddingProvider = {
      id: "fake",
      model: "fake-model",
      dimensions: 512,
      embed: async () => {
        throw new EmbeddingError("transient", "temporary");
      },
    };
    const firstReport = await runEmbeddingPipeline(
      records,
      failingStore,
      failingProvider,
      { ...baseOptions, retry: { ...retry, maxRetries: 1 } },
    );
    expect(firstReport.failed).toBe(2);
    expect(firstReport.updated).toBe(0);

    // Second run: still nothing persisted (existing empty) so both are stale
    // again, and a working provider embeds the remaining records.
    const { store: workingStore, upserts } = makeStore(new Map());
    const secondReport = await runEmbeddingPipeline(
      records,
      workingStore,
      new FakeEmbeddingProvider(),
      baseOptions,
    );
    expect(secondReport.attempted).toBe(2);
    expect(secondReport.updated).toBe(2);
    expect(upserts).toHaveLength(2);
  });
});
