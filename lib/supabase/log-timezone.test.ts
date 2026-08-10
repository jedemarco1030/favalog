import { describe, expect, it } from "vitest";

import { datetimeLocalToISO, validateLogInput } from "./log-input";

describe("datetimeLocalToISO", () => {
  it("interprets a datetime-local value as LOCAL time (no day shift)", () => {
    // A `datetime-local` string carries no timezone; it must be read in the
    // viewer's local zone. Round-tripping through Date must preserve the local
    // wall-clock date/time the user entered.
    const iso = datetimeLocalToISO("2026-08-10T16:30");
    expect(iso).not.toBeNull();
    const date = new Date(iso as string);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // August (0-based)
    expect(date.getDate()).toBe(10);
    expect(date.getHours()).toBe(16);
    expect(date.getMinutes()).toBe(30);
  });

  it("does not move a bare date to the previous local day", () => {
    // The classic bug: `new Date("2026-08-10")` is UTC midnight, which renders
    // as Aug 9 in any negative-offset zone. The helper forces local midnight,
    // so the local calendar date stays put regardless of timezone.
    const iso = datetimeLocalToISO("2026-08-10");
    expect(iso).not.toBeNull();
    const date = new Date(iso as string);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(10);
  });

  it("returns null for empty or unparseable input", () => {
    expect(datetimeLocalToISO("")).toBeNull();
    expect(datetimeLocalToISO(null)).toBeNull();
    expect(datetimeLocalToISO("not-a-date")).toBeNull();
  });
});

describe("validateLogInput logged date", () => {
  it("normalizes a local datetime to ISO without shifting the day", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");
    const result = validateLogInput(
      { mediaSlug: "x", loggedAt: "2026-08-10T16:30" },
      now,
    );
    expect(result.ok).toBe(true);
    const local = new Date(result.value?.loggedAt as string);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getDate()).toBe(10);
  });

  it("rejects a future date", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const result = validateLogInput(
      { mediaSlug: "x", loggedAt: "2999-01-01T00:00" },
      now,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.loggedAt).toBeTruthy();
  });
});
