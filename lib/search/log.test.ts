import { describe, expect, it, vi } from "vitest";

import {
  SEARCH_LOG_EVENT,
  SEARCH_LOG_SCHEMA_VERSION,
  buildSearchLog,
  logSearch,
  newRequestId,
  type SearchLogEvent,
  type SearchLogFields,
} from "@/lib/search/log";

/**
 * The complete allow-list of keys the EMITTED event may ever contain. This is
 * the closed schema: the emitted record adds `event`, `schemaVersion`, and the
 * derived `zeroResult` on top of the safe input fields.
 */
const ALLOWED_KEYS = new Set<keyof SearchLogEvent>([
  "event",
  "schemaVersion",
  "requestId",
  "mode",
  "queryLength",
  "kind",
  "resultCount",
  "zeroResult",
  "semanticAttempted",
  "compatibleCorpus",
  "embeddingModel",
  "embeddingTokens",
  "keywordMs",
  "compatMs",
  "embeddingMs",
  "hybridDbMs",
  "totalMs",
  "errorCategory",
  "fallbackReason",
]);

/**
 * Keys that must NEVER appear in a telemetry line — raw/normalized query text,
 * media identity, vectors, provider responses, user identity, or credentials.
 */
const FORBIDDEN_KEYS = [
  "query",
  "q",
  "queryText",
  "normalizedQuery",
  "title",
  "slug",
  "mediaTitle",
  "mediaSlug",
  "vector",
  "vectors",
  "embedding",
  "embeddingVector",
  "response",
  "providerResponse",
  "token",
  "apiKey",
  "openaiApiKey",
  "OPENAI_API_KEY",
  "userId",
  "user",
  "username",
  "email",
  "session",
  "cookie",
  "ip",
  "ipAddress",
  "userAgent",
  "password",
  "databaseUrl",
  "connectionString",
];

function baseFields(overrides: Partial<SearchLogFields> = {}): SearchLogFields {
  return {
    requestId: "req-1",
    mode: "keyword",
    queryLength: 12,
    kind: "all",
    resultCount: 3,
    semanticAttempted: false,
    compatibleCorpus: false,
    ...overrides,
  };
}

describe("buildSearchLog", () => {
  it("stamps the fixed event name and the schema version", () => {
    const log = buildSearchLog(baseFields());
    expect(log.event).toBe(SEARCH_LOG_EVENT);
    expect(log.event).toBe("catalog_search");
    expect(log.schemaVersion).toBe(SEARCH_LOG_SCHEMA_VERSION);
  });

  it("returns only keys within the allowed, closed set", () => {
    const log = buildSearchLog(
      baseFields({
        semanticAttempted: true,
        compatibleCorpus: true,
        embeddingModel: "text-embedding-3-small",
        embeddingTokens: 42,
        keywordMs: 5,
        compatMs: 2,
        embeddingMs: 6,
        hybridDbMs: 7,
        totalMs: 20,
        errorCategory: "transient",
        fallbackReason: "timeout",
      }),
    );

    for (const key of Object.keys(log)) {
      expect(ALLOWED_KEYS.has(key as keyof SearchLogEvent)).toBe(true);
    }
  });

  it("never emits a forbidden sensitive key, on any field permutation", () => {
    const permutations: SearchLogFields[] = [
      baseFields(),
      baseFields({
        mode: "hybrid",
        semanticAttempted: true,
        compatibleCorpus: true,
      }),
      baseFields({
        mode: "keyword_fallback",
        semanticAttempted: true,
        compatibleCorpus: false,
        fallbackReason: "incompatible_corpus",
      }),
      baseFields({
        resultCount: 0,
        errorCategory: "database",
        keywordMs: 1,
        compatMs: 1,
        embeddingMs: 1,
        hybridDbMs: 1,
        totalMs: 4,
        embeddingModel: "text-embedding-3-small",
        embeddingTokens: 7,
      }),
    ];

    for (const fields of permutations) {
      const keys = Object.keys(buildSearchLog(fields));
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it("carries only the query LENGTH, never the text", () => {
    const log = buildSearchLog(baseFields({ queryLength: 12 }));
    expect(log.queryLength).toBe(12);
    expect(Object.keys(log)).not.toContain("query");
  });

  it("derives zeroResult from the result count", () => {
    expect(buildSearchLog(baseFields({ resultCount: 0 })).zeroResult).toBe(
      true,
    );
    expect(buildSearchLog(baseFields({ resultCount: 5 })).zeroResult).toBe(
      false,
    );
  });

  it("always includes the semantic-attempted and compatible-corpus indicators", () => {
    const log = buildSearchLog(
      baseFields({ semanticAttempted: true, compatibleCorpus: true }),
    );
    expect(log.semanticAttempted).toBe(true);
    expect(log.compatibleCorpus).toBe(true);
  });

  it("omits optional fields when they are undefined", () => {
    const keys = Object.keys(buildSearchLog(baseFields()));
    expect(keys).not.toContain("embeddingModel");
    expect(keys).not.toContain("embeddingTokens");
    expect(keys).not.toContain("keywordMs");
    expect(keys).not.toContain("compatMs");
    expect(keys).not.toContain("embeddingMs");
    expect(keys).not.toContain("hybridDbMs");
    expect(keys).not.toContain("totalMs");
    expect(keys).not.toContain("errorCategory");
    expect(keys).not.toContain("fallbackReason");
  });

  it("keeps the compatibility-check and hybrid-database timings distinct", () => {
    const log = buildSearchLog(
      baseFields({
        semanticAttempted: true,
        compatibleCorpus: true,
        compatMs: 3,
        hybridDbMs: 9,
      }),
    );
    expect(log.compatMs).toBe(3);
    expect(log.hybridDbMs).toBe(9);
  });

  it("includes optional fields when they are provided", () => {
    const log = buildSearchLog(
      baseFields({
        mode: "keyword_fallback",
        semanticAttempted: true,
        compatibleCorpus: false,
        embeddingModel: "text-embedding-3-small",
        embeddingTokens: 99,
        keywordMs: 1,
        compatMs: 2,
        embeddingMs: 3,
        hybridDbMs: 4,
        totalMs: 10,
        errorCategory: "transient",
        fallbackReason: "database",
      }),
    );

    expect(log.embeddingModel).toBe("text-embedding-3-small");
    expect(log.embeddingTokens).toBe(99);
    expect(log.keywordMs).toBe(1);
    expect(log.compatMs).toBe(2);
    expect(log.embeddingMs).toBe(3);
    expect(log.hybridDbMs).toBe(4);
    expect(log.totalMs).toBe(10);
    expect(log.errorCategory).toBe("transient");
    expect(log.fallbackReason).toBe("database");
  });
});

describe("logSearch", () => {
  it("emits a single JSON line carrying the fixed event name and schema version", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      logSearch(baseFields({ resultCount: 0 }));
      expect(spy).toHaveBeenCalledTimes(1);
      const line = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(line);
      expect(parsed.event).toBe("catalog_search");
      expect(parsed.schemaVersion).toBe(SEARCH_LOG_SCHEMA_VERSION);
      expect(parsed.zeroResult).toBe(true);
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(Object.keys(parsed)).not.toContain(forbidden);
      }
    } finally {
      spy.mockRestore();
    }
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
