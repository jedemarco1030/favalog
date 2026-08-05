import { describe, expect, it } from "vitest";

import { isProfileComplete } from "@/lib/auth/profile";

describe("isProfileComplete", () => {
  it("returns false for null", () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it("returns true for a valid username and non-empty display name", () => {
    expect(isProfileComplete({ username: "jamie", displayName: "Jamie" })).toBe(
      true,
    );
  });

  it("returns true when username is uppercase (DB-valid) and display name is non-empty", () => {
    expect(
      isProfileComplete({ username: "JohnDoe", displayName: "John" }),
    ).toBe(true);
  });

  it("returns false when username is too short", () => {
    expect(isProfileComplete({ username: "ab", displayName: "Jamie" })).toBe(
      false,
    );
  });

  it("returns false when display name is empty/whitespace", () => {
    expect(isProfileComplete({ username: "jamie", displayName: "   " })).toBe(
      false,
    );
  });

  it("returns false when username has invalid characters", () => {
    expect(isProfileComplete({ username: "ab-c", displayName: "Jamie" })).toBe(
      false,
    );
  });
});
