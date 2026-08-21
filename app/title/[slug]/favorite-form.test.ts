import { describe, expect, it } from "vitest";

import { parseFavoriteFormData } from "./favorite-form";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

describe("parseFavoriteFormData", () => {
  it("reads the trusted slug and a 'true' desired state", () => {
    const input = parseFavoriteFormData(
      formData({ mediaSlug: "afterglow", isFavorite: "true" }),
    );
    expect(input).toEqual({ mediaSlug: "afterglow", isFavorite: true });
  });

  it("treats a 'false' desired state as removal", () => {
    const input = parseFavoriteFormData(
      formData({ mediaSlug: "northlight", isFavorite: "false" }),
    );
    expect(input).toEqual({ mediaSlug: "northlight", isFavorite: false });
  });

  it("defaults a missing / non-'true' desired state to false", () => {
    expect(parseFavoriteFormData(formData({ mediaSlug: "x" })).isFavorite).toBe(
      false,
    );
    expect(
      parseFavoriteFormData(formData({ mediaSlug: "x", isFavorite: "1" }))
        .isFavorite,
    ).toBe(false);
  });

  it("never reads a user id, position, or media UUID (allow-list only)", () => {
    const input = parseFavoriteFormData(
      formData({
        mediaSlug: "afterglow",
        isFavorite: "true",
        userId: "hacker",
        position: "0",
        mediaId: "00000000-0000-0000-0000-000000000000",
      }),
    );
    expect(input).toEqual({ mediaSlug: "afterglow", isFavorite: true });
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("position");
    expect(input).not.toHaveProperty("mediaId");
  });
});
