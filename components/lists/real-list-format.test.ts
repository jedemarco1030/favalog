import { describe, expect, it } from "vitest";
import {
  formatUpdatedAt,
  isPrivateVisibility,
  toCreateVisibility,
  visibilityLabel,
} from "@/components/lists/real-list-format";

describe("visibilityLabel", () => {
  it("labels public and private lists", () => {
    expect(visibilityLabel("public")).toBe("Public");
    expect(visibilityLabel("private")).toBe("Private");
  });

  it("treats the reserved followers visibility as private", () => {
    expect(visibilityLabel("followers")).toBe("Private");
  });
});

describe("isPrivateVisibility", () => {
  it("is false only for public lists", () => {
    expect(isPrivateVisibility("public")).toBe(false);
  });

  it("is true for private and the reserved followers visibility", () => {
    expect(isPrivateVisibility("private")).toBe(true);
    expect(isPrivateVisibility("followers")).toBe(true);
  });
});

describe("toCreateVisibility", () => {
  it("maps public to public", () => {
    expect(toCreateVisibility("public")).toBe("public");
  });

  it("reconciles private and the reserved followers to private", () => {
    expect(toCreateVisibility("private")).toBe("private");
    expect(toCreateVisibility("followers")).toBe("private");
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
