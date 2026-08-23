import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_RESULT_LIMIT,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER_ID,
  EMBEDDING_TIMEOUT_MS,
  KEYWORD_CANDIDATE_LIMIT,
  MAX_QUERY_LENGTH,
  MAX_RESULT_LIMIT,
  PIPELINE_BATCH_SIZE,
  PIPELINE_CONCURRENCY,
  PIPELINE_MAX_RETRIES,
  PIPELINE_RETRY_BASE_MS,
  PIPELINE_RETRY_MAX_MS,
  RRF_K,
  SEMANTIC_CANDIDATE_LIMIT,
  clampResultLimit,
  isSemanticSearchConfigured,
  isSemanticSearchEnabled,
  shouldAttemptSemanticSearch,
} from "@/lib/search/config";

describe("exported constants", () => {
  it("match their documented identity values", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_DIMENSIONS).toBe(512);
    expect(EMBEDDING_PROVIDER_ID).toBe("openai");
    expect(RRF_K).toBe(60);
    expect(KEYWORD_CANDIDATE_LIMIT).toBe(50);
    expect(SEMANTIC_CANDIDATE_LIMIT).toBe(50);
    expect(DEFAULT_RESULT_LIMIT).toBe(24);
    expect(MAX_RESULT_LIMIT).toBe(50);
    expect(MAX_QUERY_LENGTH).toBe(200);
    expect(EMBEDDING_TIMEOUT_MS).toBe(2500);
    expect(PIPELINE_BATCH_SIZE).toBe(16);
    expect(PIPELINE_CONCURRENCY).toBe(3);
    expect(PIPELINE_MAX_RETRIES).toBe(4);
    expect(PIPELINE_RETRY_BASE_MS).toBe(500);
    expect(PIPELINE_RETRY_MAX_MS).toBe(8000);
  });
});

describe("clampResultLimit", () => {
  it("falls back to DEFAULT_RESULT_LIMIT when undefined", () => {
    expect(clampResultLimit(undefined)).toBe(DEFAULT_RESULT_LIMIT);
  });

  it("uses an explicit fallback when undefined", () => {
    expect(clampResultLimit(undefined, 7)).toBe(7);
  });

  it("clamps values below 1 up to 1", () => {
    expect(clampResultLimit(0)).toBe(1);
    expect(clampResultLimit(-10)).toBe(1);
  });

  it("clamps values above MAX_RESULT_LIMIT down to the ceiling", () => {
    expect(clampResultLimit(MAX_RESULT_LIMIT + 1)).toBe(MAX_RESULT_LIMIT);
    expect(clampResultLimit(10_000)).toBe(MAX_RESULT_LIMIT);
  });

  it("keeps an in-range value untouched", () => {
    expect(clampResultLimit(10)).toBe(10);
  });

  it("floors decimal values", () => {
    expect(clampResultLimit(5.9)).toBe(5);
    expect(clampResultLimit(1.9)).toBe(1);
  });

  it("falls back for NaN and Infinity", () => {
    expect(clampResultLimit(Number.NaN)).toBe(DEFAULT_RESULT_LIMIT);
    expect(clampResultLimit(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_RESULT_LIMIT,
    );
    expect(clampResultLimit(Number.NEGATIVE_INFINITY, 9)).toBe(9);
  });
});

describe("semantic-search environment predicates", () => {
  const savedSwitch = process.env.SEMANTIC_SEARCH_ENABLED;
  const savedKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.SEMANTIC_SEARCH_ENABLED;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (savedSwitch === undefined) {
      delete process.env.SEMANTIC_SEARCH_ENABLED;
    } else {
      process.env.SEMANTIC_SEARCH_ENABLED = savedSwitch;
    }
    if (savedKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = savedKey;
    }
  });

  describe("isSemanticSearchEnabled", () => {
    it("defaults to enabled when the switch is unset", () => {
      expect(isSemanticSearchEnabled()).toBe(true);
    });

    it("defaults to enabled when the switch is blank / whitespace", () => {
      process.env.SEMANTIC_SEARCH_ENABLED = "   ";
      expect(isSemanticSearchEnabled()).toBe(true);
    });

    it("stays enabled for a truthy token", () => {
      process.env.SEMANTIC_SEARCH_ENABLED = "true";
      expect(isSemanticSearchEnabled()).toBe(true);
    });

    it.each(["false", "0", "off", "no"])(
      "disables for the falsey token %s",
      (token) => {
        process.env.SEMANTIC_SEARCH_ENABLED = token;
        expect(isSemanticSearchEnabled()).toBe(false);
      },
    );

    it("disables case-insensitively and with surrounding spaces", () => {
      process.env.SEMANTIC_SEARCH_ENABLED = "  FALSE  ";
      expect(isSemanticSearchEnabled()).toBe(false);
      process.env.SEMANTIC_SEARCH_ENABLED = " Off ";
      expect(isSemanticSearchEnabled()).toBe(false);
    });
  });

  describe("isSemanticSearchConfigured", () => {
    it("is false when the key is unset", () => {
      expect(isSemanticSearchConfigured()).toBe(false);
    });

    it("is false when the key is blank / whitespace", () => {
      process.env.OPENAI_API_KEY = "   ";
      expect(isSemanticSearchConfigured()).toBe(false);
    });

    it("is true when a non-blank key is present", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      expect(isSemanticSearchConfigured()).toBe(true);
    });
  });

  describe("shouldAttemptSemanticSearch", () => {
    it("requires both the switch on and a configured key", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      expect(shouldAttemptSemanticSearch()).toBe(true);
    });

    it("is false when enabled but not configured", () => {
      expect(isSemanticSearchEnabled()).toBe(true);
      expect(shouldAttemptSemanticSearch()).toBe(false);
    });

    it("is false when configured but disabled", () => {
      process.env.SEMANTIC_SEARCH_ENABLED = "false";
      process.env.OPENAI_API_KEY = "sk-test";
      expect(shouldAttemptSemanticSearch()).toBe(false);
    });

    it("is false when both are off", () => {
      process.env.SEMANTIC_SEARCH_ENABLED = "off";
      expect(shouldAttemptSemanticSearch()).toBe(false);
    });
  });
});
