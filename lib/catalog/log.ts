/**
 * Redaction-safe structured logging for catalog-provider operations.
 *
 * A single choke point emits a closed, versioned event so operational evidence
 * (via runtime logs) is consistent and can never accidentally leak sensitive
 * data. The event carries ONLY safe fields: provider, operation, outcome,
 * coarse latency bucket, retry count, and a safe error category. It NEVER
 * carries query text, media titles/slugs, credentials, raw provider payloads,
 * URLs, or vectors.
 *
 * The emit sink is dependency-injected so tests need no console and no network,
 * and the whole module is import-safe (no I/O, no secrets at import time).
 */

import type { ProviderErrorCategory } from "./errors";
import type { ExternalProvider } from "./types";

/** Schema version for the structured event; bump on any field change. */
export const CATALOG_LOG_SCHEMA_VERSION = 1 as const;

/** The outcome of a provider operation. */
export type CatalogOperationOutcome = "ok" | "error";

/** The closed, safe shape of a catalog operation log event. */
export interface CatalogLogEvent {
  event: "catalog_provider";
  schemaVersion: typeof CATALOG_LOG_SCHEMA_VERSION;
  provider: ExternalProvider;
  /** Logical operation, e.g. `search` or `getByExternalId`. */
  operation: string;
  outcome: CatalogOperationOutcome;
  /** Coarse latency bucket (not the exact millisecond) to avoid fingerprinting. */
  latencyBucket: LatencyBucket;
  /** Number of retries performed (0 when the first attempt succeeded). */
  retries: number;
  /** Safe error category, present only when `outcome === "error"`. */
  errorCategory?: ProviderErrorCategory;
  /** Whether the operation ran against fixture/fake data (never a live call). */
  fake?: boolean;
}

/** Coarse latency buckets. Deliberately not the raw duration. */
export type LatencyBucket =
  "lt_100ms" | "lt_500ms" | "lt_1s" | "lt_3s" | "gte_3s";

/** Bucket a raw millisecond latency into a coarse label. */
export function bucketLatency(ms: number): LatencyBucket {
  if (ms < 100) return "lt_100ms";
  if (ms < 500) return "lt_500ms";
  if (ms < 1000) return "lt_1s";
  if (ms < 3000) return "lt_3s";
  return "gte_3s";
}

/** The sink that receives a fully-formed, safe event. Injected for testability. */
export type CatalogLogSink = (event: CatalogLogEvent) => void;

/** Default sink: a single structured JSON line to stdout (safe fields only). */
export const consoleLogSink: CatalogLogSink = (event) => {
  console.log(JSON.stringify(event));
};

/** Fields the caller supplies; the choke point fills in the invariant shape. */
export interface CatalogLogInput {
  provider: ExternalProvider;
  operation: string;
  outcome: CatalogOperationOutcome;
  latencyMs: number;
  retries: number;
  errorCategory?: ProviderErrorCategory;
  fake?: boolean;
}

/**
 * Build and emit a safe catalog log event through `sink`. This is the ONLY way
 * catalog operations should log, so redaction is enforced in one place: the
 * function accepts a raw latency and buckets it, and never accepts (so can never
 * emit) query text, ids, URLs, or payloads.
 */
export function logCatalogOperation(
  input: CatalogLogInput,
  sink: CatalogLogSink = consoleLogSink,
): void {
  const event: CatalogLogEvent = {
    event: "catalog_provider",
    schemaVersion: CATALOG_LOG_SCHEMA_VERSION,
    provider: input.provider,
    operation: input.operation,
    outcome: input.outcome,
    latencyBucket: bucketLatency(input.latencyMs),
    retries: input.retries,
    ...(input.errorCategory ? { errorCategory: input.errorCategory } : {}),
    ...(input.fake ? { fake: true } : {}),
  };
  sink(event);
}
