import { describe, expect, it } from "vitest";

import { validateSetFavoriteInput } from "./favorite-input";

describe("validateSetFavoriteInput", () => {
  it("accepts a trimmed slug with an explicit true desired state", () => {
    const result = validateSetFavoriteInput({
      mediaSlug: "  afterglow  ",
      isFavorite: true,
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ mediaSlug: "afterglow", isFavorite: true });
  });

  it("accepts an explicit false desired state (removal)", () => {
    const result = validateSetFavoriteInput({
      mediaSlug: "northlight",
      isFavorite: false,
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      mediaSlug: "northlight",
      isFavorite: false,
    });
  });

  it("rejects a missing / blank media slug with a safe message", () => {
    const result = validateSetFavoriteInput({
      mediaSlug: "   ",
      isFavorite: true,
    });
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.message).toMatch(/which title/i);
  });

  it("rejects a non-boolean desired state", () => {
    const result = validateSetFavoriteInput({
      mediaSlug: "afterglow",
      // Simulate an untrusted/malformed value slipping past the type boundary.
      isFavorite: "true" as unknown as boolean,
    });
    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.message).toMatch(/add or remove/i);
  });
});
