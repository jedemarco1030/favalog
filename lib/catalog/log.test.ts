import { describe, expect, it } from "vitest";

import {
  bucketLatency,
  CATALOG_LOG_SCHEMA_VERSION,
  logCatalogOperation,
  type CatalogLogEvent,
} from "./log";

describe("bucketLatency", () => {
  it("buckets latencies at the documented boundaries", () => {
    expect(bucketLatency(0)).toBe("lt_100ms");
    expect(bucketLatency(99)).toBe("lt_100ms");
    expect(bucketLatency(100)).toBe("lt_500ms");
    expect(bucketLatency(499)).toBe("lt_500ms");
    expect(bucketLatency(500)).toBe("lt_1s");
    expect(bucketLatency(999)).toBe("lt_1s");
    expect(bucketLatency(1000)).toBe("lt_3s");
    expect(bucketLatency(2999)).toBe("lt_3s");
    expect(bucketLatency(3000)).toBe("gte_3s");
    expect(bucketLatency(10000)).toBe("gte_3s");
  });
});

describe("logCatalogOperation", () => {
  function capture(): {
    events: CatalogLogEvent[];
    sink: (e: CatalogLogEvent) => void;
  } {
    const events: CatalogLogEvent[] = [];
    return { events, sink: (event) => events.push(event) };
  }

  it("emits a versioned event with only the safe keys on success", () => {
    const { events, sink } = capture();
    logCatalogOperation(
      {
        provider: "tmdb",
        operation: "search",
        outcome: "ok",
        latencyMs: 250,
        retries: 0,
      },
      sink,
    );
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event).toEqual({
      event: "catalog_provider",
      schemaVersion: CATALOG_LOG_SCHEMA_VERSION,
      provider: "tmdb",
      operation: "search",
      outcome: "ok",
      latencyBucket: "lt_500ms",
      retries: 0,
    });
    // The exact keys, nothing more.
    expect(Object.keys(event).sort()).toEqual(
      [
        "event",
        "latencyBucket",
        "operation",
        "outcome",
        "provider",
        "retries",
        "schemaVersion",
      ].sort(),
    );
  });

  it("includes errorCategory only when the outcome is an error", () => {
    const { events, sink } = capture();
    logCatalogOperation(
      {
        provider: "openlibrary",
        operation: "getByExternalId",
        outcome: "error",
        latencyMs: 1200,
        retries: 2,
        errorCategory: "not_found",
      },
      sink,
    );
    const [event] = events;
    expect(event.outcome).toBe("error");
    expect(event.errorCategory).toBe("not_found");
    expect(event.latencyBucket).toBe("lt_3s");
    expect(event.retries).toBe(2);
  });

  it("omits errorCategory when not provided (success path)", () => {
    const { events, sink } = capture();
    logCatalogOperation(
      {
        provider: "tmdb",
        operation: "search",
        outcome: "ok",
        latencyMs: 10,
        retries: 0,
      },
      sink,
    );
    expect(events[0]).not.toHaveProperty("errorCategory");
  });

  it("includes fake only when true", () => {
    const { events, sink } = capture();
    logCatalogOperation(
      {
        provider: "tmdb",
        operation: "search",
        outcome: "ok",
        latencyMs: 10,
        retries: 0,
        fake: true,
      },
      sink,
    );
    expect(events[0].fake).toBe(true);

    const second = capture();
    logCatalogOperation(
      {
        provider: "tmdb",
        operation: "search",
        outcome: "ok",
        latencyMs: 10,
        retries: 0,
        fake: false,
      },
      second.sink,
    );
    expect(second.events[0]).not.toHaveProperty("fake");
  });

  it("never carries query text, titles, URLs, tokens, or a raw latency", () => {
    const { events, sink } = capture();
    logCatalogOperation(
      {
        provider: "tmdb",
        operation: "search",
        outcome: "ok",
        latencyMs: 137,
        retries: 0,
      },
      sink,
    );
    const [event] = events;
    const keys = Object.keys(event);
    for (const forbidden of [
      "query",
      "title",
      "slug",
      "url",
      "token",
      "latencyMs",
      "latency",
      "vector",
      "payload",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
    // Latency is bucketed, not raw.
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("137");
    expect(event.latencyBucket).toBe("lt_500ms");
  });
});
