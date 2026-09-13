import { describe, expect, it } from "vitest";

import { decodeFeedCursor, encodeFeedCursor } from "./feed-cursor";

const ID = "11111111-2222-4333-8444-555555555555";
const MICRO = "2026-09-13T17:47:00.123456+00:00";

describe("encodeFeedCursor", () => {
  it("encodes a diary position in the versioned wire format", () => {
    expect(
      encodeFeedCursor({ createdAt: MICRO, source: "diary", id: ID }),
    ).toBe(`v1:${MICRO}:diary:${ID}`);
  });

  it("returns null when any part is missing", () => {
    expect(encodeFeedCursor({})).toBeNull();
    expect(encodeFeedCursor({ createdAt: MICRO, source: "diary" })).toBeNull();
    expect(encodeFeedCursor({ createdAt: MICRO, id: ID })).toBeNull();
    expect(encodeFeedCursor({ source: "review", id: ID })).toBeNull();
  });

  it("rejects an unknown source, a bad uuid, and a zone-less timestamp", () => {
    expect(
      encodeFeedCursor({ createdAt: MICRO, source: "favorite", id: ID }),
    ).toBeNull();
    expect(
      encodeFeedCursor({ createdAt: MICRO, source: "diary", id: "nope" }),
    ).toBeNull();
    expect(
      encodeFeedCursor({
        createdAt: "2026-09-13T17:47:00",
        source: "diary",
        id: ID,
      }),
    ).toBeNull();
  });
});

describe("decodeFeedCursor", () => {
  it("round-trips both sources", () => {
    for (const source of ["diary", "review"] as const) {
      const raw = encodeFeedCursor({ createdAt: MICRO, source, id: ID });
      expect(raw).not.toBeNull();
      expect(decodeFeedCursor(raw)).toEqual({
        createdAt: MICRO,
        source,
        id: ID,
      });
    }
  });

  it("preserves exact microsecond precision (no Date rounding)", () => {
    const raw = `v1:${MICRO}:diary:${ID}`;
    const decoded = decodeFeedCursor(raw);
    expect(decoded?.createdAt).toBe("2026-09-13T17:47:00.123456+00:00");
    // A Date round-trip would have truncated to milliseconds.
    expect(decoded?.createdAt).not.toBe(
      new Date(MICRO).toISOString().replace("Z", "+00:00"),
    );
  });

  it("accepts a Z-suffixed timestamp and trims surrounding whitespace", () => {
    expect(
      decodeFeedCursor(`  v1:2026-09-13T17:47:00Z:review:${ID}  `),
    ).toEqual({ createdAt: "2026-09-13T17:47:00Z", source: "review", id: ID });
  });

  it("rejects a wrong or missing version", () => {
    expect(decodeFeedCursor(`v2:${MICRO}:diary:${ID}`)).toBeNull();
    expect(decodeFeedCursor(`${MICRO}:diary:${ID}`)).toBeNull();
  });

  it("rejects a malformed shape", () => {
    expect(decodeFeedCursor("")).toBeNull();
    expect(decodeFeedCursor("   ")).toBeNull();
    expect(decodeFeedCursor("v1")).toBeNull();
    expect(decodeFeedCursor(`v1:diary:${ID}`)).toBeNull();
    expect(decodeFeedCursor(null)).toBeNull();
    expect(decodeFeedCursor(undefined)).toBeNull();
    expect(decodeFeedCursor(42)).toBeNull();
    expect(decodeFeedCursor({ createdAt: MICRO })).toBeNull();
  });

  it("rejects a non-ISO timestamp", () => {
    expect(decodeFeedCursor(`v1:yesterday:diary:${ID}`)).toBeNull();
    expect(decodeFeedCursor(`v1:2026-09-13:diary:${ID}`)).toBeNull();
    expect(decodeFeedCursor(`v1:2026-09-13T17:47:00:diary:${ID}`)).toBeNull();
  });

  it("rejects an unknown source", () => {
    expect(decodeFeedCursor(`v1:${MICRO}:list:${ID}`)).toBeNull();
    expect(decodeFeedCursor(`v1:${MICRO}:DIARY:${ID}`)).toBeNull();
  });

  it("rejects a malformed uuid", () => {
    expect(decodeFeedCursor(`v1:${MICRO}:diary:not-a-uuid`)).toBeNull();
    expect(
      decodeFeedCursor(`v1:${MICRO}:diary:11111111-2222-4333-8444-5555`),
    ).toBeNull();
  });
});
