import { describe, expect, it } from "vitest";
import {
  formatUpdatedAt,
  isPrivateVisibility,
  toCreateVisibility,
  visibilityLabel,
} from "@/components/lists/real-list-format";

describe("visibilityLabel", () => {
  it("labels public, followers, and private lists", () => {
    expect(visibilityLabel("public")).toBe("Public");
    expect(visibilityLabel("followers")).toBe("Followers");
    expect(visibilityLabel("private")).toBe("Private");
  });
});

describe("isPrivateVisibility", () => {
  it("is false only for public lists", () => {
    expect(isPrivateVisibility("public")).toBe(false);
  });

  it("is true for private and followers visibility", () => {
    expect(isPrivateVisibility("private")).toBe(true);
    expect(isPrivateVisibility("followers")).toBe(true);
  });
});

describe("toCreateVisibility", () => {
  it("maps each visibility directly", () => {
    expect(toCreateVisibility("public")).toBe("public");
    expect(toCreateVisibility("followers")).toBe("followers");
    expect(toCreateVisibility("private")).toBe("private");
  });
});

describe("formatUpdatedAt", () => {
  it('formats a valid ISO timestamp as "Month YYYY"', () => {
    expect(formatUpdatedAt("2026-08-19T15:31:00.000Z")).toBe("August 2026");
  });

  it("returns null for an invalid date string", () => {
    expect(formatUpdatedAt("not-a-date")).toBeNull();
  });
});
