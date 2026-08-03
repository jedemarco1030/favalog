import { describe, expect, it } from "vitest";
import {
  diaryEntries,
  diaryOwnerId,
  getDiaryEntriesByType,
  getDiaryEntriesForUser,
  getDiaryEntryMedia,
  getDiarySummary,
} from "./diary";

describe("getDiaryEntriesForUser", () => {
  it("returns the owner's entries sorted newest first", () => {
    const entries = getDiaryEntriesForUser();
    expect(entries.length).toBe(diaryEntries.length);
    expect(entries.every((e) => e.userId === diaryOwnerId)).toBe(true);
    const timestamps = entries.map((e) => e.loggedAt);
    expect(timestamps).toEqual(
      [...timestamps].sort((a, b) => (a < b ? 1 : -1)),
    );
  });

  it("returns an empty list for an unknown user", () => {
    expect(getDiaryEntriesForUser("u_nobody")).toEqual([]);
  });
});

describe("getDiaryEntriesByType", () => {
  it("returns only entries whose resolved media matches the kind", () => {
    const books = getDiaryEntriesByType("book");
    expect(books.length).toBeGreaterThan(0);
    expect(
      books.every((entry) => getDiaryEntryMedia(entry)?.kind === "book"),
    ).toBe(true);
  });

  it("partitions the diary across kinds without loss", () => {
    const movies = getDiaryEntriesByType("movie").length;
    const tv = getDiaryEntriesByType("tv").length;
    const books = getDiaryEntriesByType("book").length;
    expect(movies + tv + books).toBe(getDiaryEntriesForUser().length);
  });
});

describe("getDiaryEntryMedia", () => {
  it("resolves the media referenced by an entry", () => {
    const entry = getDiaryEntriesForUser()[0];
    expect(getDiaryEntryMedia(entry)?.id).toBe(entry.mediaId);
  });
});

describe("getDiarySummary", () => {
  it("summarizes the most recent year and its kind counts", () => {
    const summary = getDiarySummary();
    const expectedYear = Math.max(
      ...diaryEntries.map((e) => new Date(e.loggedAt).getFullYear()),
    );
    expect(summary.year).toBe(expectedYear);
    expect(summary.movies + summary.tv + summary.books).toBe(summary.total);
    expect(summary.total).toBeGreaterThan(0);
  });
});
