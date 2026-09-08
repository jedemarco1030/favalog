import { describe, expect, it } from "vitest";

import { GENERIC_SET_FOLLOW_ERROR, mapSetFollowError } from "./follow-errors";

describe("mapSetFollowError", () => {
  it("maps 28000 and auth messages to sign-in message", () => {
    expect(
      mapSetFollowError({ code: "28000", message: "authentication required" }),
    ).toBe("Please sign in to continue.");
  });

  it("maps cannot follow self to clear user message", () => {
    expect(
      mapSetFollowError({ code: "22023", message: "cannot follow self" }),
    ).toBe("You cannot follow your own profile.");
  });

  it("maps P0002 to not found profile message", () => {
    expect(
      mapSetFollowError({
        code: "P0002",
        message: "unknown profile: nonexistent",
      }),
    ).toBe("We couldn't find that profile. Please refresh and try again.");
  });

  it("maps 22023 invalid arguments to user-friendly invalid request message", () => {
    expect(
      mapSetFollowError({ code: "22023", message: "invalid username: ab" }),
    ).toBe("That request wasn't valid. Please try again.");
    expect(
      mapSetFollowError({ code: "22023", message: "invalid follow state" }),
    ).toBe("That request wasn't valid. Please try again.");
  });

  it("maps 42501 to permission message", () => {
    expect(
      mapSetFollowError({ code: "42501", message: "insufficient privilege" }),
    ).toBe("You don't have permission to do that.");
  });

  it("maps unknown database errors to generic fallback message", () => {
    expect(
      mapSetFollowError({ code: "XX000", message: "internal error" }),
    ).toBe(GENERIC_SET_FOLLOW_ERROR);
    expect(mapSetFollowError({ message: "something weird" })).toBe(
      GENERIC_SET_FOLLOW_ERROR,
    );
  });
});
