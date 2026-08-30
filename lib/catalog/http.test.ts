import { describe, expect, it, vi } from "vitest";

import { CatalogProviderError } from "./errors";
import { fetchProviderJson, type FetchLike } from "./http";
import type { RetryEnvironment } from "./reliability";

const retryEnv: RetryEnvironment = { sleep: async () => {}, random: () => 0 };

/** Build a minimal Response-like object matching what `http.ts` reads. */
function res(
  body: unknown,
  init: {
    ok?: boolean;
    status?: number;
    headers?: Record<string, string>;
    badJson?: boolean;
  } = {},
): Response {
  const headers = new Map(
    Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: init.badJson
      ? async () => {
          throw new SyntaxError("bad json");
        }
      : async () => body,
  } as unknown as Response;
}

function baseOptions(fetchImpl: FetchLike) {
  return {
    provider: "tmdb" as const,
    operation: "search",
    url: "https://example.test/x",
    fetchImpl,
    retryEnv,
  };
}

describe("fetchProviderJson", () => {
  it("returns parsed data with zero retries on success", async () => {
    const fetchImpl = vi.fn(async () => res({ hello: "world" }));
    const result = await fetchProviderJson<{ hello: string }>(
      baseOptions(fetchImpl),
    );
    expect(result.data).toEqual({ hello: "world" });
    expect(result.retries).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 honouring Retry-After, then succeeds", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        res({}, { ok: false, status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(res({ ok: true }));
    const result = await fetchProviderJson(baseOptions(fetchImpl));
    expect(result.retries).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404 (terminal not_found)", async () => {
    const fetchImpl = vi.fn(async () => res({}, { ok: false, status: 404 }));
    await expect(
      fetchProviderJson(baseOptions(fetchImpl)),
    ).rejects.toMatchObject({
      category: "not_found",
      status: 404,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 401 (terminal unauthorized)", async () => {
    const fetchImpl = vi.fn(async () => res({}, { ok: false, status: 401 }));
    await expect(
      fetchProviderJson(baseOptions(fetchImpl)),
    ).rejects.toMatchObject({
      category: "unauthorized",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 500 up to the attempt cap then throws unavailable", async () => {
    const fetchImpl = vi.fn(async () => res({}, { ok: false, status: 503 }));
    await expect(
      fetchProviderJson(baseOptions(fetchImpl)),
    ).rejects.toMatchObject({
      category: "unavailable",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("maps an unparseable 2xx body to unavailable", async () => {
    const fetchImpl = vi.fn(async () => res(null, { badJson: true }));
    await expect(
      fetchProviderJson(baseOptions(fetchImpl)),
    ).rejects.toMatchObject({
      category: "unavailable",
    });
  });

  it("maps an internal timeout (TimeoutError) to a retryable timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("timed out");
      err.name = "TimeoutError";
      throw err;
    });
    await expect(
      fetchProviderJson(baseOptions(fetchImpl)),
    ).rejects.toBeInstanceOf(CatalogProviderError);
    // Timeout is retryable → attempts exhausted.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("treats a caller abort as terminal and does not retry", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    await expect(
      fetchProviderJson({
        ...baseOptions(fetchImpl),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps a generic network failure to a retryable unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      fetchProviderJson(baseOptions(fetchImpl)),
    ).rejects.toMatchObject({
      category: "unavailable",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
