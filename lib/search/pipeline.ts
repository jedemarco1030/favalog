/**
 * The embedding pipeline core — pure, dependency-injected, and unit-testable.
 *
 * Given the desired catalog embedding *records* (each already carrying its
 * canonical document + content hash), an {@link EmbeddingStore} (read existing +
 * upsert), and an {@link EmbeddingProvider}, this:
 *
 *   - selects only MISSING or STALE records (unchanged ones are never re-embedded);
 *   - processes bounded batches with bounded concurrency;
 *   - retries transient failures with capped exponential backoff and STOPS
 *     immediately on a fatal (config/auth) error;
 *   - records the returned model identity + token usage;
 *   - upserts idempotently (safe to resume after a partial failure);
 *   - reports attempted / updated / unchanged / failed / token / duration counts.
 *
 * It performs NO I/O of its own beyond the injected provider/store, never logs
 * API keys or full vectors, and supports a dry run that selects work without
 * calling the provider or writing anything. The CLI (`scripts/embed-catalog.mjs`)
 * wires the real Supabase store + provider around this core.
 */

import { PIPELINE_BATCH_SIZE, PIPELINE_CONCURRENCY } from "./config.ts";
import { EmbeddingError, isFatalPipelineError } from "./embedding-errors.ts";
import { withRetry, type RetryOptions } from "./retry.ts";
import type { EmbeddingProvider } from "./embedding-provider";

/** The desired embedding for one catalog title. */
export interface EmbeddingRecord {
  mediaId: string;
  slug: string;
  /** The exact canonical text to embed. */
  document: string;
  /** Deterministic content hash of the versioned document. */
  contentHash: string;
}

/**
 * What the store already knows about an existing embedding row.
 *
 * The provenance fields (`provider`, `model`, `dimensions`, `documentVersion`)
 * are part of the embedding IDENTITY: a row is only "unchanged" when they all
 * match the provider identity the current run would produce. They are null on a
 * content-only row that has no embedding yet (`hasEmbedding: false`).
 */
export interface ExistingEmbedding {
  contentHash: string;
  hasEmbedding: boolean;
  provider: string | null;
  model: string | null;
  dimensions: number | null;
  documentVersion: string | null;
}

/**
 * The complete embedding identity the current run would produce. A stored row is
 * only skipped when every one of these matches (in addition to an equal content
 * hash and a present embedding). Supplied by the server/pipeline — never by a
 * client — so fake or otherwise incompatible vectors are always re-embedded.
 */
export interface ExpectedEmbeddingIdentity {
  provider: string;
  model: string;
  dimensions: number;
  documentVersion: string;
}

/** A fully-embedded row to persist (all-or-nothing embedding provenance). */
export interface EmbeddingUpsert {
  mediaId: string;
  content: string;
  contentHash: string;
  documentVersion: string;
  embedding: number[];
  model: string;
  provider: string;
  dimensions: number;
  embeddedAt: string;
}

/** Read existing embedding metadata and persist new embeddings. */
export interface EmbeddingStore {
  loadExisting(): Promise<Map<string, ExistingEmbedding>>;
  upsert(row: EmbeddingUpsert): Promise<void>;
}

/** Aggregated outcome of a pipeline run. */
export interface PipelineReport {
  attempted: number;
  updated: number;
  unchanged: number;
  failed: number;
  tokens: number;
  durationMs: number;
}

/** Options for {@link runEmbeddingPipeline}. */
export interface PipelineOptions {
  dryRun?: boolean;
  batchSize?: number;
  concurrency?: number;
  documentVersion: string;
  /** Monotonic clock in ms (defaults to performance.now). */
  now?: () => number;
  /** Wall-clock ISO timestamp source for `embedded_at` (defaults to now). */
  timestamp?: () => string;
  /** Retry overrides (injectable sleep/random for deterministic tests). */
  retry?: RetryOptions;
  /**
   * Re-embed every record regardless of stored provenance (recovery escape
   * hatch). This never replaces the automatic provenance staleness detection —
   * it only forces work the detection would otherwise skip.
   */
  force?: boolean;
  /** Optional safe progress callback (never receives keys/vectors). */
  onProgress?: (info: {
    batch: number;
    batches: number;
    updated: number;
    failed: number;
  }) => void;
}

/**
 * Partition records into those needing (re)embedding and those unchanged.
 *
 * A record is UNCHANGED only when a prior row exists AND it carries a complete
 * embedding AND its content hash matches AND its full embedding identity
 * (provider, model, dimensions, document version) matches the {@link
 * ExpectedEmbeddingIdentity} the current run would produce. Any other state —
 * no row, missing embedding, differing hash, or a provenance mismatch (e.g. a
 * fake row facing a real OpenAI run, or a provider/model/dimensions/version
 * change) — is treated as STALE and re-embedded.
 *
 * When `force` is set every record is stale (a recovery escape hatch); it never
 * substitutes for the automatic provenance detection above.
 */
export function selectStale(
  records: readonly EmbeddingRecord[],
  existing: ReadonlyMap<string, ExistingEmbedding>,
  expected: ExpectedEmbeddingIdentity,
  options: { force?: boolean } = {},
): { toEmbed: EmbeddingRecord[]; unchanged: EmbeddingRecord[] } {
  const toEmbed: EmbeddingRecord[] = [];
  const unchanged: EmbeddingRecord[] = [];
  for (const record of records) {
    const prior = existing.get(record.mediaId);
    const isFresh =
      !options.force &&
      !!prior &&
      prior.hasEmbedding &&
      prior.contentHash === record.contentHash &&
      prior.provider === expected.provider &&
      prior.model === expected.model &&
      prior.dimensions === expected.dimensions &&
      prior.documentVersion === expected.documentVersion;
    (isFresh ? unchanged : toEmbed).push(record);
  }
  return { toEmbed, unchanged };
}

/** Split an array into fixed-size chunks (last chunk may be smaller). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size));
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    batches.push(items.slice(i, i + safeSize));
  }
  return batches;
}

/** Run up to `limit` async workers concurrently over `items`. */
async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/**
 * Execute the embedding pipeline. Returns a {@link PipelineReport}. Re-throws a
 * fatal provider error (config/auth) so the CLI can stop with a clear message.
 */
export async function runEmbeddingPipeline(
  records: readonly EmbeddingRecord[],
  store: EmbeddingStore,
  provider: EmbeddingProvider,
  options: PipelineOptions,
): Promise<PipelineReport> {
  const now = options.now ?? (() => performance.now());
  const timestamp = options.timestamp ?? (() => new Date().toISOString());
  const batchSize = options.batchSize ?? PIPELINE_BATCH_SIZE;
  const concurrency = options.concurrency ?? PIPELINE_CONCURRENCY;
  const startedAt = now();

  const existing = await store.loadExisting();
  const expected: ExpectedEmbeddingIdentity = {
    provider: provider.id,
    model: provider.model,
    dimensions: provider.dimensions,
    documentVersion: options.documentVersion,
  };
  const { toEmbed, unchanged } = selectStale(records, existing, expected, {
    force: options.force,
  });

  const report: PipelineReport = {
    attempted: toEmbed.length,
    updated: 0,
    unchanged: unchanged.length,
    failed: 0,
    tokens: 0,
    durationMs: 0,
  };

  if (options.dryRun || toEmbed.length === 0) {
    report.durationMs = now() - startedAt;
    return report;
  }

  const batches = chunk(toEmbed, batchSize);
  let processed = 0;

  await runPool(batches, concurrency, async (batch) => {
    const texts = batch.map((record) => record.document);
    try {
      const response = await withRetry(
        () => provider.embed(texts),
        options.retry,
      );
      report.tokens += response.usage?.totalTokens ?? 0;
      const embeddedAt = timestamp();
      for (let i = 0; i < batch.length; i++) {
        const record = batch[i];
        const vector = response.vectors[i];
        if (!vector) {
          report.failed += 1;
          continue;
        }
        await store.upsert({
          mediaId: record.mediaId,
          content: record.document,
          contentHash: record.contentHash,
          documentVersion: options.documentVersion,
          embedding: vector,
          model: response.model,
          provider: provider.id,
          dimensions: response.dimensions,
          embeddedAt,
        });
        report.updated += 1;
      }
    } catch (error) {
      // Fatal (config/auth): abort the whole run so we don't hammer the provider.
      if (error instanceof EmbeddingError && isFatalPipelineError(error))
        throw error;
      // Transient failure after exhausting retries: leave these stale (resumable).
      report.failed += batch.length;
    } finally {
      processed += 1;
      options.onProgress?.({
        batch: processed,
        batches: batches.length,
        updated: report.updated,
        failed: report.failed,
      });
    }
  });

  report.durationMs = now() - startedAt;
  return report;
}
