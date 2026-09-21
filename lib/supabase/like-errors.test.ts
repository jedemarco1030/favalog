import { describe, expect, it } from "vitest";

import {
  GENERIC_SET_LIKE_ERROR,
  SESSION_EXPIRED_ERROR,
  UNAVAILABLE_TARGET_ERROR,
  mapSetLikeError,
} from "./like-errors";

describe("mapSetLikeError", () => {
  it("maps a lapsed session (28000) to the neutral sign-in message", () => {
    expect(
      mapSetLikeError({ code: "28000", message: "authentication required" }),
    ).toBe(SESSION_EXPIRED_ERROR);
  });

  it("maps a no-accessible-target (P0002) to the uniform unavailable message", () => {
    expect(
      mapSetLikeError({ code: "P0002", message: "no accessible list" }),
    ).toBe(UNAVAILABLE_TARGET_ERROR);
  });

  it("uses the SAME message for a private and a nonexistent target (no disclosure)", () => {
    const privateList = mapSetLikeError({
      code: "P0002",
      message: "list 999 is private",
    });
    const missingList = mapSetLikeError({
      code: "P0002",
      message: "list 000 does not exist",
    });
    expect(privateList).toBe(UNAVAILABLE_TARGET_ERROR);
    expect(privateList).toBe(missingList);
  });

  it("maps malformed input and unknown errors to the generic retry message", () => {
    expect(
      mapSetLikeError({ code: "22023", message: "invalid input syntax" }),
    ).toBe(GENERIC_SET_LIKE_ERROR);
    expect(mapSetLikeError({ code: "XX000", message: "boom" })).toBe(
      GENERIC_SET_LIKE_ERROR,
    );
    expect(mapSetLikeError(null)).toBe(GENERIC_SET_LIKE_ERROR);
    expect(mapSetLikeError(undefined)).toBe(GENERIC_SET_LIKE_ERROR);
  });
});
