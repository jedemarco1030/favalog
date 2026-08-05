import { describe, expect, it } from "vitest";

import {
  DEFAULT_REDIRECT,
  getSafeRedirectPath,
} from "@/lib/auth/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("exports the expected DEFAULT_REDIRECT", () => {
    expect(DEFAULT_REDIRECT).toBe("/");
  });

  it("accepts safe same-origin relative paths", () => {
    const safePaths = ["/", "/explore", "/profile/jamie?tab=lists#top"];
    for (const path of safePaths) {
      expect(getSafeRedirectPath(path)).toBe(path);
      expect(getSafeRedirectPath(path, "/fallback")).toBe(path);
    }
  });

  it("falls back to DEFAULT_REDIRECT for unsafe non-string and unsafe string inputs", () => {
    const unsafeInputs: unknown[] = [
      null,
      undefined,
      123,
      {},
      "",
      "   ",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "mailto:x",
      "/explore path",
      "/explore\tpath",
      "/explore\npath",
    ];

    for (const input of unsafeInputs) {
      expect(getSafeRedirectPath(input)).toBe(DEFAULT_REDIRECT);
    }
  });

  it("returns the provided fallback for unsafe candidates", () => {
    const fallback = "/fallback";

    expect(getSafeRedirectPath(null, fallback)).toBe(fallback);
    expect(getSafeRedirectPath("", fallback)).toBe(fallback);
    expect(getSafeRedirectPath("https://evil.example", fallback)).toBe(
      fallback,
    );
    expect(getSafeRedirectPath("//evil.example", fallback)).toBe(fallback);
    expect(getSafeRedirectPath("/\\evil.example", fallback)).toBe(fallback);
    expect(getSafeRedirectPath("javascript:alert(1)", fallback)).toBe(fallback);
    expect(getSafeRedirectPath("/explore path", fallback)).toBe(fallback);
  });
});
