import { describe, expect, it } from "vitest";

import {
  isLoopbackHttpUrl,
  isProductionRuntime,
  isTestTransportEnabled,
  resolveTestProviderBaseUrl,
  OPENLIBRARY_TEST_BASE_URL_ENV,
  TEST_TRANSPORT_ENABLE_ENV,
  TMDB_TEST_BASE_URL_ENV,
} from "./test-transport";

/** Build an env object; explicit and isolated so nothing reads process.env. */
function env(over: Record<string, string | undefined> = {}) {
  return { ...over };
}

const LOOPBACK = "http://127.0.0.1:5599";

describe("isProductionRuntime", () => {
  it("is true on a Vercel production runtime", () => {
    expect(isProductionRuntime(env({ VERCEL_ENV: "production" }))).toBe(true);
    expect(isProductionRuntime(env({ VERCEL: "1" }))).toBe(true);
  });

  it("is false off a Vercel deployment", () => {
    expect(isProductionRuntime(env())).toBe(false);
    expect(isProductionRuntime(env({ VERCEL_ENV: "preview" }))).toBe(false);
  });
});

describe("isTestTransportEnabled (explicit opt-in, never in production)", () => {
  it("is OFF by default (no opt-in)", () => {
    expect(isTestTransportEnabled(env())).toBe(false);
  });

  it.each(["1", "true", "on", "yes", " YES "])(
    "is ON for the explicit truthy opt-in %p",
    (token) => {
      expect(
        isTestTransportEnabled(env({ [TEST_TRANSPORT_ENABLE_ENV]: token })),
      ).toBe(true);
    },
  );

  it.each(["0", "false", "off", "", "maybe"])(
    "stays OFF for the non-truthy opt-in %p",
    (token) => {
      expect(
        isTestTransportEnabled(env({ [TEST_TRANSPORT_ENABLE_ENV]: token })),
      ).toBe(false);
    },
  );

  it("is REJECTED under a production runtime even with the opt-in on", () => {
    expect(
      isTestTransportEnabled(
        env({ [TEST_TRANSPORT_ENABLE_ENV]: "1", VERCEL_ENV: "production" }),
      ),
    ).toBe(false);
    expect(
      isTestTransportEnabled(
        env({ [TEST_TRANSPORT_ENABLE_ENV]: "1", VERCEL: "1" }),
      ),
    ).toBe(false);
  });
});

describe("isLoopbackHttpUrl (loopback http only)", () => {
  it.each([
    "http://127.0.0.1:5599",
    "http://localhost:3000/x",
    "http://[::1]:8080",
  ])("accepts the loopback http URL %p", (url) => {
    expect(isLoopbackHttpUrl(url)).toBe(true);
  });

  it.each([
    "https://127.0.0.1:5599", // https not accepted
    "http://api.themoviedb.org", // public host
    "http://169.254.169.254", // link-local metadata endpoint
    "http://example.com",
    "ftp://127.0.0.1",
    "not a url",
    "",
  ])("rejects the non-loopback/non-http value %p", (url) => {
    expect(isLoopbackHttpUrl(url)).toBe(false);
  });
});

describe("resolveTestProviderBaseUrl", () => {
  it("returns undefined without the opt-in even if a loopback URL is set", () => {
    expect(
      resolveTestProviderBaseUrl(
        "tmdb",
        env({ [TMDB_TEST_BASE_URL_ENV]: LOOPBACK }),
      ),
    ).toBeUndefined();
  });

  it("returns the loopback base per provider when enabled", () => {
    const e = env({
      [TEST_TRANSPORT_ENABLE_ENV]: "1",
      [TMDB_TEST_BASE_URL_ENV]: "http://127.0.0.1:5599/tmdb/",
      [OPENLIBRARY_TEST_BASE_URL_ENV]: "http://127.0.0.1:5599/ol",
    });
    // Trailing slash trimmed for clean concatenation with adapter paths.
    expect(resolveTestProviderBaseUrl("tmdb", e)).toBe(
      "http://127.0.0.1:5599/tmdb",
    );
    expect(resolveTestProviderBaseUrl("openlibrary", e)).toBe(
      "http://127.0.0.1:5599/ol",
    );
  });

  it("FAILS CLOSED for a non-loopback override even with the opt-in on", () => {
    expect(
      resolveTestProviderBaseUrl(
        "tmdb",
        env({
          [TEST_TRANSPORT_ENABLE_ENV]: "1",
          [TMDB_TEST_BASE_URL_ENV]: "https://api.themoviedb.org/3",
        }),
      ),
    ).toBeUndefined();
  });

  it("is REJECTED in production even with the opt-in and a loopback URL", () => {
    expect(
      resolveTestProviderBaseUrl(
        "tmdb",
        env({
          [TEST_TRANSPORT_ENABLE_ENV]: "1",
          VERCEL_ENV: "production",
          [TMDB_TEST_BASE_URL_ENV]: LOOPBACK,
        }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined when enabled but the provider URL is unset", () => {
    expect(
      resolveTestProviderBaseUrl(
        "tmdb",
        env({ [TEST_TRANSPORT_ENABLE_ENV]: "1" }),
      ),
    ).toBeUndefined();
  });
});
