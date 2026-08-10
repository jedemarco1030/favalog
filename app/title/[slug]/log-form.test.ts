import { describe, expect, it } from "vitest";

import { parseLogFormData } from "./log-form";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("parseLogFormData", () => {
  it("reads only the LogMediaInput fields (no user/ownership fields)", () => {
    const input = parseLogFormData(
      form({
        mediaSlug: "dune-part-two",
        loggedAt: "2026-08-10T16:30",
        rating: "4.5",
        isRevisit: "on",
        reviewTitle: "A triumph",
        reviewBody: "Loved it.",
        containsSpoilers: "on",
        // Injected ownership fields that MUST be ignored:
        userId: "attacker",
        id: "someone-elses-entry",
      }),
    );

    expect(input).toEqual({
      mediaSlug: "dune-part-two",
      loggedAt: "2026-08-10T16:30",
      rating: 4.5,
      isRevisit: true,
      reviewTitle: "A triumph",
      reviewBody: "Loved it.",
      containsSpoilers: true,
    });
    expect(input).not.toHaveProperty("userId");
    expect(input).not.toHaveProperty("id");
  });

  it("treats an empty rating as no rating (null)", () => {
    expect(
      parseLogFormData(form({ mediaSlug: "x", rating: "" })).rating,
    ).toBeNull();
  });

  it("coerces a non-numeric rating to null rather than NaN", () => {
    expect(
      parseLogFormData(form({ mediaSlug: "x", rating: "abc" })).rating,
    ).toBeNull();
  });

  it("defaults checkboxes to false when absent", () => {
    const input = parseLogFormData(form({ mediaSlug: "x" }));
    expect(input.isRevisit).toBe(false);
    expect(input.containsSpoilers).toBe(false);
  });
});
