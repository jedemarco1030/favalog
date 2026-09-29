import { describe, expect, it, vi } from "vitest";

import { buildDiscoveryLog, logDiscoveryEvent } from "./log";

describe("discovery events", () => {
  it("buckets latency and stamps the schema version", () => {
    expect(
      buildDiscoveryLog({
        event: "discovery.shelf_unavailable",
        provider: "tmdb",
        shelfId: "tmdb-trending-movies",
        page: 2,
        category: "timeout",
        latencyMs: 4200,
      }),
    ).toEqual({
      event: "discovery.shelf_unavailable",
      schemaVersion: 1,
      provider: "tmdb",
      shelfId: "tmdb-trending-movies",
      page: 2,
      category: "timeout",
      latencyBucket: "gte_3s",
    });
  });

  it("emits only the closed save-failure fields", () => {
    const sink = vi.fn();
    logDiscoveryEvent(
      {
        event: "discovery.save_add_failed",
        provider: "rawg",
        reason: "error",
        latencyMs: 42,
      },
      sink,
    );

    const event = sink.mock.calls[0][0];
    expect(Object.keys(event).sort()).toEqual(
      ["event", "latencyBucket", "provider", "reason", "schemaVersion"].sort(),
    );
    expect(event.latencyBucket).toBe("lt_100ms");
  });
});
