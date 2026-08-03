import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names with a single space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values so conditional classes stay clean", () => {
    const active = false;
    const disabled = true;
    expect(cn("base", active && "active", disabled && "disabled")).toBe(
      "base disabled",
    );
    expect(cn(null, undefined, "", "only")).toBe("only");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});
