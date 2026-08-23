import { describe, expect, it, vi } from "vitest";

import { EmbeddingError } from "@/lib/search/embedding-errors";
import { computeBackoffMs, withRetry } from "@/lib/search/retry";

describe("withRetry", () => {
  it("resolves on the first try without retrying", async () => {
    const fn = vi.fn(async () => "ok");
    const sleep = vi.fn(async () => {});

    const result = await withRetry(fn, { sleep, random: () => 0 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a transient failure then succeeds", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new EmbeddingError("transient", "temporary");
      return "recovered";
    });
    const sleep = vi.fn(async () => {});

    const result = await withRetry(fn, { sleep, random: () => 0 });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    // One retry -> injected sleep invoked exactly once.
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("stops immediately on a fatal auth error and rethrows it", async () => {
    const fatal = new EmbeddingError("auth", "rejected key");
    const fn = vi.fn(async () => {
      throw fatal;
    });
    const sleep = vi.fn(async () => {});

    await expect(withRetry(fn, { sleep, random: () => 0 })).rejects.toBe(fatal);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops immediately on a fatal config error and rethrows it", async () => {
    const fatal = new EmbeddingError("config", "missing key");
    const fn = vi.fn(async () => {
      throw fatal;
    });
    const sleep = vi.fn(async () => {});

    await expect(withRetry(fn, { sleep, random: () => 0 })).rejects.toBe(fatal);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("exhausts maxRetries then throws the last error", async () => {
    const maxRetries = 3;
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      throw new EmbeddingError("transient", `attempt ${calls}`);
    });
    const sleep = vi.fn(async () => {});

    await expect(
      withRetry(fn, { maxRetries, sleep, random: () => 0 }),
    ).rejects.toBeInstanceOf(EmbeddingError);
    // Initial attempt + maxRetries retries.
    expect(fn).toHaveBeenCalledTimes(maxRetries + 1);
    // One sleep per retry (not after the final failed attempt).
    expect(sleep).toHaveBeenCalledTimes(maxRetries);
  });

  it("invokes onRetry with attempt, delayMs, and kind", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new EmbeddingError("rate_limit", "slow down");
      return "done";
    });
    const onRetry = vi.fn();
    const sleep = vi.fn(async () => {});

    await withRetry(fn, {
      sleep,
      random: () => 0,
      onRetry,
      baseMs: 100,
      maxMs: 1000,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 0,
      kind: "rate_limit",
    });
  });

  it("reports kind 'unknown' for a non-EmbeddingError retryable failure", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("plain failure");
      return "done";
    });
    const onRetry = vi.fn();
    const sleep = vi.fn(async () => {});

    await withRetry(fn, {
      sleep,
      random: () => 0,
      onRetry,
      // Treat everything as retryable so the plain error is retried.
      isFatal: () => false,
    });

    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "unknown" }),
    );
  });
});

describe("computeBackoffMs", () => {
  it("returns 0 when random() is 0", () => {
    expect(computeBackoffMs(0, 500, 8000, () => 0)).toBe(0);
    expect(computeBackoffMs(3, 500, 8000, () => 0)).toBe(0);
  });

  it("approaches min(maxMs, baseMs*2^attempt) as random approaches 1 and grows with attempt", () => {
    const baseMs = 100;
    const maxMs = 100000;
    const random = () => 0.999999;

    const attempt0 = computeBackoffMs(0, baseMs, maxMs, random);
    const attempt1 = computeBackoffMs(1, baseMs, maxMs, random);
    const attempt2 = computeBackoffMs(2, baseMs, maxMs, random);

    // Each stays under its uncapped exponential ceiling.
    expect(attempt0).toBeLessThanOrEqual(baseMs * 2 ** 0);
    expect(attempt1).toBeLessThanOrEqual(baseMs * 2 ** 1);
    expect(attempt2).toBeLessThanOrEqual(baseMs * 2 ** 2);
    // And the ceiling grows with the attempt index.
    expect(attempt1).toBeGreaterThan(attempt0);
    expect(attempt2).toBeGreaterThan(attempt1);
  });

  it("caps the delay at maxMs for a large attempt", () => {
    const baseMs = 500;
    const maxMs = 8000;
    const delay = computeBackoffMs(30, baseMs, maxMs, () => 0.999999);
    expect(delay).toBeLessThanOrEqual(maxMs);
  });
});
