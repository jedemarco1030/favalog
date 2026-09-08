import { describe, expect, it } from "vitest";

import { validateSetFollowInput } from "./follow-input";

describe("validateSetFollowInput", () => {
  it("accepts valid usernames with true follow state", () => {
    const result = validateSetFollowInput({
      username: "alice_123",
      isFollow: true,
    });
    expect(result).toEqual({
      ok: true,
      value: { username: "alice_123", isFollow: true },
    });
  });

  it("accepts valid usernames with false follow state (unfollow)", () => {
    const result = validateSetFollowInput({
      username: "bob",
      isFollow: false,
    });
    expect(result).toEqual({
      ok: true,
      value: { username: "bob", isFollow: false },
    });
  });

  it("trims whitespace around username", () => {
    const result = validateSetFollowInput({
      username: "  carol_test  ",
      isFollow: true,
    });
    expect(result).toEqual({
      ok: true,
      value: { username: "carol_test", isFollow: true },
    });
  });

  it("rejects empty or blank username", () => {
    expect(validateSetFollowInput({ username: "", isFollow: true })).toEqual({
      ok: false,
      message: "A username is required.",
    });
    expect(validateSetFollowInput({ username: "   ", isFollow: true })).toEqual(
      {
        ok: false,
        message: "A username is required.",
      },
    );
  });

  it("rejects username shorter than 3 characters", () => {
    const result = validateSetFollowInput({ username: "ab", isFollow: true });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/3–30 letters/i);
  });

  it("rejects username longer than 30 characters", () => {
    const result = validateSetFollowInput({
      username: "a".repeat(31),
      isFollow: true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/3–30 letters/i);
  });

  it("rejects username containing invalid characters", () => {
    const result = validateSetFollowInput({
      username: "alice-invalid!",
      isFollow: true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/3–30 letters/i);
  });

  it("rejects non-boolean isFollow", () => {
    const result = validateSetFollowInput({
      username: "valid_user",
      isFollow: null as unknown as boolean,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/desired follow state is required/i);
  });
});
