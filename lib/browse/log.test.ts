import { describe, expect, it, vi } from "vitest";
import {
  BROWSE_LOG_EVENT,
  BROWSE_LOG_SCHEMA_VERSION,
  browseResultCountBucket,
  buildBrowseLog,
  latencyBucket,
  logBrowse,
  type BrowseLogFields,
} from "./log";

const BASE: BrowseLogFields = {
  outcome: "ok",
  sort: "recently_added",
  mediaType: "all",
  genreFiltered: false,
  page: 1,
  totalPages: 2,
  resultCountBucket: "11-24",
  latencyBucket: "50-200ms",
};

describe("browseResultCountBucket", () => {
  it("buckets counts into fixed, low-cardinality ranges", () => {
    expect(browseResultCountBucket(0)).toBe("0");
    expect(browseResultCountBucket(-3)).toBe("0");
    expect(browseResultCountBucket(2)).toBe("1-3");
    expect(browseResultCountBucket(7)).toBe("4-10");
    expect(browseResultCountBucket(20)).toBe("11-24");
    expect(browseResultCountBucket(99)).toBe("25+");
    expect(browseResultCountBucket(NaN)).toBe("0");
  });
});

describe("latencyBucket", () => {
  it("buckets latency into coarse bands", () => {
    expect(latencyBucket(undefined)).toBe("unknown");
    expect(latencyBucket(-1)).toBe("unknown");
    expect(latencyBucket(10)).toBe("<50ms");
    expect(latencyBucket(120)).toBe("50-200ms");
    expect(latencyBucket(300)).toBe("200-500ms");
    expect(latencyBucket(800)).toBe("500-1000ms");
    expect(latencyBucket(4000)).toBe("1000ms+");
  });
});

describe("buildBrowseLog", () => {
  it("stamps the fixed event name and schema version", () => {
    const event = buildBrowseLog(BASE);
    expect(event.event).toBe(BROWSE_LOG_EVENT);
    expect(event.schemaVersion).toBe(BROWSE_LOG_SCHEMA_VERSION);
  });

  it("is a CLOSED schema: only allow-listed, non-sensitive keys are emitted", () => {
    const event = buildBrowseLog(BASE);
    expect(Object.keys(event).sort()).toEqual(
      [
        "event",
        "genreFiltered",
        "latencyBucket",
        "mediaType",
        "outcome",
        "page",
        "resultCountBucket",
        "schemaVersion",
        "sort",
        "totalPages",
      ].sort(),
    );
  });

  it("never carries identity, title/slug, or raw genre text", () => {
    // Attempt to smuggle sensitive fields via a wider object; they must not
    // survive the closed builder.
    const smuggled = {
      ...BASE,
      userId: "u-1",
      title: "Dune",
      slug: "dune",
      genre: "Science Fiction",
      query: "space",
    } as unknown as BrowseLogFields;
    const event = buildBrowseLog(smuggled);
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("u-1");
    expect(serialized).not.toContain("Dune");
    expect(serialized).not.toContain("Science Fiction");
    expect(serialized).not.toContain("space");
  });
});

describe("logBrowse", () => {
  it("emits a single JSON line via console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logBrowse(BASE);
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.event).toBe(BROWSE_LOG_EVENT);
    expect(parsed.outcome).toBe("ok");
    spy.mockRestore();
  });
});
