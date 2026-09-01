import { describe, expect, it } from "vitest";
import { totalPagesFor } from "./browse-view-model";

describe("totalPagesFor", () => {
  it("returns at least 1 page even for an empty catalog", () => {
    expect(totalPagesFor(0, 24)).toBe(1);
    expect(totalPagesFor(-5, 24)).toBe(1);
    expect(totalPagesFor(NaN, 24)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(totalPagesFor(24, 24)).toBe(1);
    expect(totalPagesFor(25, 24)).toBe(2);
    expect(totalPagesFor(29, 24)).toBe(2);
    expect(totalPagesFor(48, 24)).toBe(2);
    expect(totalPagesFor(49, 24)).toBe(3);
  });

  it("guards a non-positive page size", () => {
    expect(totalPagesFor(100, 0)).toBe(1);
    expect(totalPagesFor(100, -10)).toBe(1);
  });
});
