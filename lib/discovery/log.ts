import type { ProviderErrorCategory } from "@/lib/catalog/errors";
import { bucketLatency, type LatencyBucket } from "@/lib/catalog/log";
import type { ExternalProvider } from "@/lib/catalog/types";

/**
 * Redaction-safe discovery events. Each event is a closed shape: it never
 * carries external ids, titles, slugs, list ids or names, user identity,
 * query text, provider payloads, or free-text error messages.
 */
export const DISCOVERY_LOG_SCHEMA_VERSION = 1 as const;

export type DiscoveryLogEvent =
  | {
      event: "discovery.shelf_unavailable";
      schemaVersion: typeof DISCOVERY_LOG_SCHEMA_VERSION;
      provider: ExternalProvider;
      shelfId: string;
      page: number;
      category: ProviderErrorCategory | "unknown";
      latencyBucket: LatencyBucket;
    }
  | {
      event: "discovery.related_unavailable";
      schemaVersion: typeof DISCOVERY_LOG_SCHEMA_VERSION;
      provider: ExternalProvider;
      category: ProviderErrorCategory | "unknown";
      latencyBucket: LatencyBucket;
    }
  | {
      /**
       * Materialization succeeded but adding the canonical title to the list
       * did not. The title now exists in the catalog; the viewer can retry the
       * add without re-importing.
       */
      event: "discovery.save_add_failed";
      schemaVersion: typeof DISCOVERY_LOG_SCHEMA_VERSION;
      provider: ExternalProvider;
      reason:
        | "invalid"
        | "error"
        | "unavailable"
        | "unauthenticated"
        | "incomplete-profile";
      latencyBucket: LatencyBucket;
    };

type WithoutEnvelope<T> = T extends unknown
  ? Omit<T, "schemaVersion" | "latencyBucket"> & { latencyMs: number }
  : never;

export type DiscoveryLogInput = WithoutEnvelope<DiscoveryLogEvent>;

export type DiscoveryLogSink = (event: DiscoveryLogEvent) => void;

const consoleSink: DiscoveryLogSink = (event) => {
  console.warn(JSON.stringify(event));
};

export function buildDiscoveryLog(input: DiscoveryLogInput): DiscoveryLogEvent {
  const { latencyMs, ...rest } = input;
  return {
    ...rest,
    schemaVersion: DISCOVERY_LOG_SCHEMA_VERSION,
    latencyBucket: bucketLatency(latencyMs),
  } as DiscoveryLogEvent;
}

export function logDiscoveryEvent(
  input: DiscoveryLogInput,
  sink: DiscoveryLogSink = consoleSink,
): void {
  sink(buildDiscoveryLog(input));
}
