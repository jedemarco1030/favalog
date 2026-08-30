import { describe, expect, it, vi } from "vitest";

import { providerError } from "./errors";
import {
  computeBackoffMs,
  parseRetryAfterMs,
  withRetry,
  type RetryEnvironment,
} from "./reliability";

const noSleepEnv = (): RetryEnvironment => ({
  sleep: vi.fn(async () => {}),
  // Non-zero jitter so a retry produces a positive (mocked, instant) delay.
  random: () => 0.5,
});

describe("computeBackoffMs", () => {
  it("honours a server-advised retry-after, capped at 10000ms", () => {
    expect(computeBackoffMs(1, 5000, () => 0.5)).toBe(5000);
    expect(computeBackoffMs(1, 20000, () => 0.5)).toBe(10000);
  });

  it("uses capped exponential backoff with full jitter otherwise", () => {
    // base 300 * 2^(n-1), * random, capped at 4000.
    expect(computeBackoffMs(1, undefined, () => 1)).toBe(300);
    expect(computeBackoffMs(2, undefined, () => 1)).toBe(600);
    expect(computeBackoffMs(10, undefined, () => 1)).toBe(4000);
    expect(computeBackoffMs(3, undefined, () => 0)).toBe(0);
  });
});

describe("parseRetryAfterMs", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfterMs("120")).toBe(120000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  it("returns undefined for missing/blank/invalid", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
    expect(parseRetryAfterMs("   ")).toBeUndefined();
    expect(parseRetryAfterMs("not-a-date")).toBeUndefined();
  });

  it("parses an HTTP-date relative to now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:30 GMT", now)).toBe(30000);
    // A past date clamps to 0.
    expect(parseRetryAfterMs("Thu, 01 Jan 2020 00:00:00 GMT", now)).toBe(0);
  });
});

describe("withRetry", () => {
  it("retries a retryable error then succeeds", async () => {
    const env = noSleepEnv();
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 3) {
        throw providerError({
          provider: "tmdb",
          operation: "op",
          category: "unavailable",
        });
      }
      return "ok";
    }, env);
    expect(result).toBe("ok");
    expect(calls).toBe(3);
    expect(env.sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry a terminal (non-retryable) error", async () => {
    const env = noSleepEnv();
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw providerError({
          provider: "tmdb",
          operation: "op",
          category: "validation",
        });
      }, env),
    ).rejects.toMatchObject({ category: "validation" });
    expect(calls).toBe(1);
  });

  it("stops after MAX_ATTEMPTS and throws the last error", async () => {
    const env = noSleepEnv();
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw providerError({
          provider: "tmdb",
          operation: "op",
          category: "rate_limited",
        });
      }, env),
    ).rejects.toMatchObject({ category: "rate_limited" });
    expect(calls).toBe(3);
  });

  it("rethrows a non-provider error immediately as terminal", async () => {
    const env = noSleepEnv();
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error("boom");
      }, env),
    ).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });
});
