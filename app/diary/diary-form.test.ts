import { describe, expect, it } from "vitest";

import { parseDeleteFormData, parseEditFormData } from "./diary-form";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

describe("parseEditFormData", () => {
  it("reads only the allow-listed edit fields", () => {
    const fd = formData({
      diaryEntryId: "11111111-1111-1111-1111-111111111111",
      loggedAt: "2026-08-01T20:00",
      rating: "4.5",
      isRevisit: "on",
      reviewTitle: "Nice",
      reviewBody: "Loved it.",
      containsSpoilers: "on",
      // Ownership / injection attempts that MUST be ignored.
      userId: "22222222-2222-2222-2222-222222222222",
      user_id: "attacker",
    });

    const input = parseEditFormData(fd);
    expect(input).toEqual({
      diaryEntryId: "11111111-1111-1111-1111-111111111111",
      loggedAt: "2026-08-01T20:00",
      rating: 4.5,
      isRevisit: true,
      reviewTitle: "Nice",
      reviewBody: "Loved it.",
      containsSpoilers: true,
    });
    // No ownership field leaks through.
    expect(input as unknown as Record<string, unknown>).not.toHaveProperty(
      "userId",
    );
    expect(input as unknown as Record<string, unknown>).not.toHaveProperty(
      "user_id",
    );
  });

  it("coerces a missing/blank rating to null and unchecked boxes to false", () => {
    const input = parseEditFormData(
      formData({ diaryEntryId: "x", rating: "  " }),
    );
    expect(input.rating).toBeNull();
    expect(input.isRevisit).toBe(false);
    expect(input.containsSpoilers).toBe(false);
  });

  it("coerces a non-numeric rating to null", () => {
    expect(
      parseEditFormData(formData({ diaryEntryId: "x", rating: "abc" })).rating,
    ).toBeNull();
  });

  it("defaults a missing diary-entry id to an empty string", () => {
    expect(parseEditFormData(new FormData()).diaryEntryId).toBe("");
  });
});

describe("parseDeleteFormData", () => {
  it("reads only the diary-entry id", () => {
    const fd = formData({
      diaryEntryId: "11111111-1111-1111-1111-111111111111",
      user_id: "attacker",
    });
    expect(parseDeleteFormData(fd)).toEqual({
      diaryEntryId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("defaults a missing id to an empty string", () => {
    expect(parseDeleteFormData(new FormData()).diaryEntryId).toBe("");
  });
});
