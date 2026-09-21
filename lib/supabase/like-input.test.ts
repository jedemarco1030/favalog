import { describe, expect, it } from "vitest";

import { validateSetLikeInput } from "./like-input";

const VALID_ID = "11111111-1111-4111-8111-111111111111";

describe("validateSetLikeInput", () => {
  it("accepts a well-formed review like with true state", () => {
    const result = validateSetLikeInput({
      targetType: "review",
      targetId: VALID_ID,
      isLiked: true,
    });
    expect(result).toEqual({
      ok: true,
      value: { targetType: "review", targetId: VALID_ID, isLiked: true },
    });
  });

  it("accepts a well-formed list unlike (false state)", () => {
    const result = validateSetLikeInput({
      targetType: "list",
      targetId: VALID_ID,
      isLiked: false,
    });
    expect(result).toEqual({
      ok: true,
      value: { targetType: "list", targetId: VALID_ID, isLiked: false },
    });
  });

  it("trims surrounding whitespace on the target id", () => {
    const result = validateSetLikeInput({
      targetType: "review",
      targetId: `  ${VALID_ID}  `,
      isLiked: true,
    });
    expect(result).toEqual({
      ok: true,
      value: { targetType: "review", targetId: VALID_ID, isLiked: true },
    });
  });

  it("rejects an unknown target type without disclosing internals", () => {
    const result = validateSetLikeInput({
      targetType: "diary" as unknown as "review",
      targetId: VALID_ID,
      isLiked: true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/what you were trying to like/i);
  });

  it("rejects a missing or malformed target id before any RPC", () => {
    expect(
      validateSetLikeInput({
        targetType: "review",
        targetId: "",
        isLiked: true,
      }).ok,
    ).toBe(false);

    const malformed = validateSetLikeInput({
      targetType: "list",
      targetId: "not-a-uuid",
      isLiked: true,
    });
    expect(malformed.ok).toBe(false);
    expect(malformed.message).toMatch(/which item to update/i);
  });

  it("rejects a non-boolean desired state", () => {
    const result = validateSetLikeInput({
      targetType: "review",
      targetId: VALID_ID,
      isLiked: null as unknown as boolean,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/add or remove/i);
  });
});
