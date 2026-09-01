import { describe, expect, it } from "vitest";

import {
  assertAllLoopback,
  assertConfiguredSupabaseIsLocal,
  assertLoopbackHostUrl,
  assertLoopbackSupabaseUrl,
  describeSupabaseTarget,
  isLoopbackHostUrl,
  isLoopbackSupabaseUrl,
} from "./local-supabase-target.mjs";

/**
 * Regression coverage for the shared, single-source-of-truth E2E Supabase
 * target guard. These prove — synchronously, with NO client, network, or test
 * process created — that hosted and deceptive URLs are rejected while only
 * unambiguous local loopback targets are accepted. All checks are pure so a
 * failure here is a failure BEFORE any admin client / Next.js server / test run.
 */

describe("isLoopbackSupabaseUrl", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://localhost:3000/rest/v1",
    "http://[::1]:54321",
    "https://127.0.0.1:54321",
    "HTTP://LocalHost:54321",
  ])("accepts the local loopback URL %p", (url) => {
    expect(isLoopbackSupabaseUrl(url)).toBe(true);
  });

  it.each([
    // remote / hosted
    "https://abcdefgh.supabase.co",
    "https://abcdefgh.supabase.co/rest/v1",
    "http://10.0.0.5:54321",
    "http://192.168.1.10:54321",
    "http://0.0.0.0:54321",
    "http://example.com",
    // user-info-obscured (the real host is after the `@`)
    "http://127.0.0.1@evil.com",
    "http://user:pass@127.0.0.1:54321",
    // non-HTTP(S) schemes
    "postgresql://127.0.0.1:5432/postgres",
    "ftp://127.0.0.1",
    "file:///etc/hosts",
    "javascript:alert(1)",
    // quoted (a common .env mistake that hides the host)
    '"http://127.0.0.1:54321"',
    "'http://127.0.0.1:54321'",
    "`http://127.0.0.1:54321`",
    // malformed / missing / unknown
    "not a url",
    "127.0.0.1:54321",
    "",
    "   ",
  ])("rejects the hosted/deceptive/invalid value %p", (url) => {
    expect(isLoopbackSupabaseUrl(url)).toBe(false);
  });

  it.each([undefined, null, 42, {}, []])(
    "rejects the non-string value %p",
    (value) => {
      expect(isLoopbackSupabaseUrl(value)).toBe(false);
    },
  );
});

describe("assertLoopbackSupabaseUrl", () => {
  it("returns the trimmed URL for a local target", () => {
    expect(assertLoopbackSupabaseUrl("  http://127.0.0.1:54321  ")).toBe(
      "http://127.0.0.1:54321",
    );
  });

  it.each([
    "https://abcdefgh.supabase.co",
    "http://user:pass@127.0.0.1:54321",
    '"http://127.0.0.1:54321"',
    "postgresql://127.0.0.1:5432/postgres",
    undefined,
  ])("throws before any use for the non-local target %p", (url) => {
    expect(() => assertLoopbackSupabaseUrl(url, "SUPABASE_URL")).toThrow(
      /Refusing to proceed/i,
    );
  });

  it("never leaks credentials from a user-info URL in the error message", () => {
    let message = "";
    try {
      assertLoopbackSupabaseUrl(
        "http://admin:sup3rsecret@db.hosted.example.com",
        "SUPABASE_URL",
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/Refusing to proceed/i);
    expect(message).not.toContain("sup3rsecret");
    expect(message).not.toContain("admin:");
  });
});

describe("describeSupabaseTarget", () => {
  it("redacts credentials, keeping only scheme/host/port", () => {
    expect(
      describeSupabaseTarget("http://admin:secret@db.hosted.example.com:5432"),
    ).toBe("http://db.hosted.example.com:5432");
  });

  it("reports missing/malformed inputs without throwing", () => {
    expect(describeSupabaseTarget("")).toBe("<missing>");
    expect(describeSupabaseTarget("not a url")).toBe("<malformed URL>");
  });
});

describe("isLoopbackHostUrl / assertLoopbackHostUrl (Postgres DB_URL)", () => {
  it.each([
    "postgresql://127.0.0.1:54322/postgres",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgres://localhost:54322/postgres",
    "postgresql://[::1]:54322/postgres",
  ])(
    "accepts the local loopback DB URL %p (any scheme, local creds ok)",
    (url) => {
      expect(isLoopbackHostUrl(url)).toBe(true);
      expect(assertLoopbackHostUrl(url, "DB_URL")).toBe(url);
    },
  );

  it.each([
    "postgresql://db.hosted.example.com:5432/postgres",
    "postgresql://postgres:pw@db.hosted.example.com:5432/postgres",
    // user-info-obscured: the real host is after the `@`
    "postgresql://127.0.0.1@db.hosted.example.com:5432/postgres",
    '"postgresql://127.0.0.1:54322/postgres"',
    "not a url",
    "",
  ])("rejects the hosted/deceptive DB URL %p", (url) => {
    expect(isLoopbackHostUrl(url)).toBe(false);
    expect(() => assertLoopbackHostUrl(url, "DB_URL")).toThrow(
      /does not resolve to a local/i,
    );
  });
});

describe("assertAllLoopback", () => {
  it("passes when every URL agrees on a local target", () => {
    expect(() =>
      assertAllLoopback([
        ["API_URL", "http://127.0.0.1:54321"],
        ["DB_URL", "http://127.0.0.1:54322"],
      ]),
    ).not.toThrow();
  });

  it("throws when any single URL disagrees (mixed local + hosted)", () => {
    expect(() =>
      assertAllLoopback([
        ["API_URL", "http://127.0.0.1:54321"],
        ["DB_URL", "https://abcdefgh.supabase.co"],
      ]),
    ).toThrow(/DB_URL/);
  });
});

describe("assertConfiguredSupabaseIsLocal", () => {
  it("allows an entirely absent Supabase URL (no-env / unconfigured build)", () => {
    expect(() => assertConfiguredSupabaseIsLocal({})).not.toThrow();
    expect(() =>
      assertConfiguredSupabaseIsLocal({
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_URL: undefined,
      }),
    ).not.toThrow();
  });

  it("allows a present local target", () => {
    expect(() =>
      assertConfiguredSupabaseIsLocal({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).not.toThrow();
  });

  it("rejects a present hosted public URL", () => {
    expect(() =>
      assertConfiguredSupabaseIsLocal({
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a present hosted server URL even if the public one is local", () => {
    expect(() =>
      assertConfiguredSupabaseIsLocal({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_URL: "https://abcdefgh.supabase.co",
      }),
    ).toThrow(/SUPABASE_URL/);
  });
});
