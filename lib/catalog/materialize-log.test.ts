import { describe, expect, it, vi } from "vitest";

import {
  logCatalogMaterialization,
  type CatalogMaterializeLogEvent,
} from "./log";

describe("logCatalogMaterialization", () => {
  it("emits a closed, redaction-safe materialization event", () => {
    const sink = vi.fn<(e: CatalogMaterializeLogEvent) => void>();
    logCatalogMaterialization(
      {
        provider: "tmdb",
        outcome: "ok",
        resolution: "created",
        latencyMs: 420,
        retries: 1,
      },
      sink,
    );
    expect(sink).toHaveBeenCalledTimes(1);
    const event = sink.mock.calls[0][0];
    expect(event).toEqual({
      event: "catalog_materialize",
      schemaVersion: 1,
      provider: "tmdb",
      operation: "materialize",
      outcome: "ok",
      resolution: "created",
      latencyBucket: "lt_500ms",
      retries: 1,
    });
  });

  it("records an ambiguous resolution and a safe error category on failure", () => {
    const sink = vi.fn<(e: CatalogMaterializeLogEvent) => void>();
    logCatalogMaterialization(
      {
        provider: "openlibrary",
        outcome: "error",
        resolution: "ambiguous",
        latencyMs: 1200,
        retries: 0,
        errorCategory: "validation",
      },
      sink,
    );
    const event = sink.mock.calls[0][0];
    expect(event.outcome).toBe("error");
    expect(event.resolution).toBe("ambiguous");
    expect(event.errorCategory).toBe("validation");
    expect(event.latencyBucket).toBe("lt_3s");
  });

  it("omits resolution/errorCategory when not supplied and never leaks free text", () => {
    const sink = vi.fn<(e: CatalogMaterializeLogEvent) => void>();
    logCatalogMaterialization(
      { provider: "tmdb", outcome: "error", latencyMs: 50, retries: 0 },
      sink,
    );
    const event = sink.mock.calls[0][0];
    expect(event).not.toHaveProperty("resolution");
    expect(event).not.toHaveProperty("errorCategory");
    // The closed event shape can only ever carry these keys.
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
});
