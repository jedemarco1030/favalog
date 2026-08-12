import { describe, expect, it } from "vitest";

import {
  GENERIC_DELETE_ERROR,
  GENERIC_EDIT_ERROR,
  GENERIC_LOG_ERROR,
  mapDeleteError,
  mapEditError,
  mapLogError,
} from "./log-errors";

describe("safe write-error mapping", () => {
  it("maps the auth error (by code and by message) to a sign-in prompt", () => {
    expect(mapLogError({ code: "28000" })).toBe("Please sign in to continue.");
    expect(mapEditError({ message: "authentication required" })).toBe(
      "Please sign in to continue.",
    );
    expect(mapDeleteError({ code: "28000" })).toBe(
      "Please sign in to continue.",
    );
  });

  it("maps the invalid-rating error consistently", () => {
    const expected =
      "That rating isn't valid. Choose a half-star value from 0.5 to 5.";
    expect(mapLogError({ code: "22023" })).toBe(expected);
    expect(mapEditError({ message: "invalid rating: 4.3" })).toBe(expected);
  });

  it("maps an RLS/privilege denial without leaking detail", () => {
    expect(mapEditError({ code: "42501", message: "permission denied" })).toBe(
      "You don't have permission to do that.",
    );
  });

  it("phrases the not-found case per write path", () => {
    // A missing catalog title (create) vs a missing/foreign diary entry.
    expect(mapLogError({ code: "P0002" })).toMatch(/find that title/i);
    expect(mapEditError({ code: "P0002" })).toMatch(/find that diary entry/i);
    expect(mapDeleteError({ message: "unknown diary entry: x" })).toMatch(
      /find that diary entry/i,
    );
  });

  it("falls back to a safe generic message per write path", () => {
    expect(mapLogError({ code: "XX000", message: "boom" })).toBe(
      GENERIC_LOG_ERROR,
    );
    expect(mapEditError({})).toBe(GENERIC_EDIT_ERROR);
    expect(mapDeleteError({})).toBe(GENERIC_DELETE_ERROR);
  });

  it("never returns raw database detail", () => {
    const raw = 'duplicate key value violates unique constraint "pk"';
    const mapped = mapEditError({ code: "23505", message: raw });
    expect(mapped).not.toContain(raw);
    expect(mapped).toBe(GENERIC_EDIT_ERROR);
  });
});
