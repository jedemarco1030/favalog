import { describe, expect, it, vi } from "vitest";

import { waitForLocalSupabaseAuth } from "../wait-local-supabase-auth.mjs";

const env = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SECRET_KEY: "local-test-admin-key",
};
const ready = () => Response.json({ users: [] });

function clock() {
  let elapsed = 0;
  return {
    now: () => elapsed,
    sleep: vi.fn(async (ms: number) => {
      elapsed += ms;
    }),
  };
}

describe("local Supabase Auth readiness", () => {
  it("accepts a working admin endpoint without writing or exposing users", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(ready());
    await expect(
      waitForLocalSupabaseAuth({ env, fetchImpl }),
    ).resolves.toMatchObject({
      attempts: 1,
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:54321/auth/v1/admin/users?page=1&per_page=1",
    );
    expect(options).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("waits through the post-reset upstream error and connection failure", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("invalid upstream response", { status: 502 }),
      )
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ready());
    const timing = clock();
    await expect(
      waitForLocalSupabaseAuth({ env, fetchImpl, ...timing }),
    ).resolves.toEqual({ attempts: 3, elapsedMs: 2000 });
    expect(timing.sleep.mock.calls).toEqual([[1000], [1000]]);
    expect(
      fetchImpl.mock.calls.every(([, options]) => options?.method === "GET"),
    ).toBe(true);
  });

  it.each([401, 403, 404])(
    "fails immediately on HTTP %s without retrying",
    async (status) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("secret error", { status }));
      const timing = clock();
      await expect(
        waitForLocalSupabaseAuth({ env, fetchImpl, ...timing }),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(timing.sleep).not.toHaveBeenCalled();
    },
  );

  it("fails at the deadline without printing credentials or response bodies", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(`upstream body ${env.SUPABASE_SECRET_KEY}`, {
          status: 503,
        }),
    );
    await expect(
      waitForLocalSupabaseAuth({
        env,
        fetchImpl,
        ...clock(),
        timeoutMs: 2500,
      }),
    ).rejects.toThrow(
      "within 2500ms (3 probes; HTTP 503); tests not executed.",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([
    () => Response.json({ message: "not Auth" }),
    () => new Response("not JSON"),
  ])(
    "does not accept a successful HTTP status with an invalid Auth payload",
    async (response) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => response());
      await expect(
        waitForLocalSupabaseAuth({ env, fetchImpl, ...clock(), timeoutMs: 1 }),
      ).rejects.toThrow("tests not executed");
    },
  );

  it("aborts a hanging request within the readiness deadline", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );
    await expect(
      waitForLocalSupabaseAuth({ env, fetchImpl, timeoutMs: 20 }),
    ).rejects.toThrow("within 20ms");
  });

  it.each([
    {
      SUPABASE_URL: "https://hosted.supabase.co",
      SUPABASE_SECRET_KEY: "secret",
    },
    {
      SUPABASE_URL: "http://127.0.0.1@hosted.supabase.co",
      SUPABASE_SECRET_KEY: "secret",
    },
    { SUPABASE_URL: env.SUPABASE_URL },
    {},
  ])(
    "fails closed before network access for unsafe or incomplete config",
    async (config) => {
      const fetchImpl = vi.fn<typeof fetch>();
      await expect(
        waitForLocalSupabaseAuth({ env: config, fetchImpl }),
      ).rejects.toThrow();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("supports the existing public-URL and legacy service-role aliases", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(ready());
    await expect(
      waitForLocalSupabaseAuth({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SECRET_KEY,
        },
        fetchImpl,
      }),
    ).resolves.toMatchObject({ attempts: 1 });
  });
});
