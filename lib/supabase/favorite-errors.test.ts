import { describe, expect, it } from "vitest";

import {
  GENERIC_SET_FAVORITE_ERROR,
  mapSetFavoriteError,
} from "./favorite-errors";

describe("mapSetFavoriteError", () => {
  it("maps an authentication error to a sign-in prompt", () => {
    expect(mapSetFavoriteError({ code: "28000" })).toMatch(/sign in/i);
    expect(mapSetFavoriteError({ message: "authentication required" })).toMatch(
      /sign in/i,
    );
  });

  it("maps an unknown media slug to a safe not-found message", () => {
    expect(mapSetFavoriteError({ code: "P0002" })).toMatch(/find that title/i);
    expect(
      mapSetFavoriteError({ message: "unknown media slug: nope" }),
    ).toMatch(/find that title/i);
  });

  it("maps an invalid desired state to a safe validation message", () => {
    expect(mapSetFavoriteError({ code: "22023" })).toMatch(/wasn't valid/i);
    expect(mapSetFavoriteError({ message: "invalid favorite state" })).toMatch(
      /wasn't valid/i,
    );
  });

  it("maps an RLS / privilege denial without leaking detail", () => {
    expect(mapSetFavoriteError({ code: "42501" })).toMatch(/permission/i);
  });

  it("falls back to the generic message for anything else", () => {
    expect(mapSetFavoriteError({ code: "XX999", message: "boom" })).toBe(
      GENERIC_SET_FAVORITE_ERROR,
    );
    expect(mapSetFavoriteError({})).toBe(GENERIC_SET_FAVORITE_ERROR);
  });
});
