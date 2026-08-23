import { describe, expect, it } from "vitest";

import {
  buildSearchLog,
  newRequestId,
  type SearchLogFields,
} from "@/lib/search/log";

/** The complete allow-list of keys a search log line may ever contain. */
const ALLOWED_KEYS = new Set<keyof SearchLogFields>([
  "requestId",
  "mode",
  "queryLength",
  "kind",
  "resultCount",
  "embeddingModel",
  "embeddingTokens",
  "keywordMs",
  "embeddingMs",
  "dbMs",
  "totalMs",
  "errorCategory",
  "fallbackReason",
]);

function baseFields(overrides: Partial<SearchLogFields> = {}): SearchLogFields {
  return {
    requestId: "req-1",
    mode: "keyword",
    queryLength: 12,
    kind: "all",
    resultCount: 3,
    ...overrides,
  };
}

describe("buildSearchLog", () => {
  it("returns only keys within the allowed, closed set", () => {
    const log = buildSearchLog(
      baseFields({
        embeddingModel: "text-embedding-3-small",
        embeddingTokens: 42,
        keywordMs: 5,
        embeddingMs: 6,
        dbMs: 7,
        totalMs: 20,
        errorCategory: "transient",
        fallbackReason: "timeout",
      }),
    );

    for (const key of Object.keys(log)) {
      expect(ALLOWED_KEYS.has(key as keyof SearchLogFields)).toBe(true);
    }
  });

  it("never includes a raw query, vector, token secret, or user identity key", () => {
    const log = buildSearchLog(baseFields());
    const keys = Object.keys(log);

    expect(keys).not.toContain("query");
    expect(keys).not.toContain("vector");
    expect(keys).not.toContain("embedding");
    expect(keys).not.toContain("token");
    expect(keys).not.toContain("apiKey");
    expect(keys).not.toContain("userId");
    expect(keys).not.toContain("user");
    // The query length is a safe signal; the text itself never appears.
    expect(log.queryLength).toBe(12);
  });

  it("omits optional fields when they are undefined", () => {
    const log = buildSearchLog(baseFields());
    const keys = Object.keys(log);

    expect(keys).not.toContain("embeddingModel");
    expect(keys).not.toContain("embeddingTokens");
    expect(keys).not.toContain("keywordMs");
    expect(keys).not.toContain("embeddingMs");
    expect(keys).not.toContain("dbMs");
    expect(keys).not.toContain("totalMs");
    expect(keys).not.toContain("errorCategory");
    expect(keys).not.toContain("fallbackReason");
  });

  it("includes optional fields when they are provided", () => {
    const log = buildSearchLog(
      baseFields({
        mode: "keyword_fallback",
        embeddingModel: "text-embedding-3-small",
        embeddingTokens: 99,
        keywordMs: 1,
        embeddingMs: 2,
        dbMs: 3,
        totalMs: 6,
        errorCategory: "transient",
        fallbackReason: "database",
      }),
    );

    expect(log.embeddingModel).toBe("text-embedding-3-small");
    expect(log.embeddingTokens).toBe(99);
    expect(log.keywordMs).toBe(1);
    expect(log.embeddingMs).toBe(2);
    expect(log.dbMs).toBe(3);
    expect(log.totalMs).toBe(6);
    expect(log.errorCategory).toBe("transient");
    expect(log.fallbackReason).toBe("database");
  });
});

describe("newRequestId", () => {
  it("returns a non-empty UUID-shaped string", () => {
    const id = newRequestId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns a different id across calls", () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });
});
