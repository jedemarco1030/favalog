import { describe, expect, it } from "vitest";

import {
  diaryActionLabel,
  excerptOf,
  summarizeDiaryViews,
  type DiaryEntryView,
} from "./diary-view";

function view(
  partial: Partial<DiaryEntryView> & Pick<DiaryEntryView, "loggedAt" | "kind">,
): DiaryEntryView {
  return {
    id: Math.random().toString(36).slice(2),
    action: partial.kind === "book" ? "read" : "watched",
    slug: "slug",
    title: "Title",
    year: 2026,
    posterUrl: "",
    ...partial,
  };
}

describe("diaryActionLabel", () => {
  it("maps every action to a human verb", () => {
    expect(diaryActionLabel("watched")).toBe("Watched");
    expect(diaryActionLabel("reread")).toBe("Reread");
  });
});

describe("excerptOf", () => {
  it("returns short bodies unchanged", () => {
    expect(excerptOf("short")).toBe("short");
  });

  it("trims long bodies on a word boundary with an ellipsis", () => {
    const body = "the quick brown fox jumps over the lazy dog again and again";
    const out = excerptOf(body, 20);
    expect(out.endsWith("\u2026")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out).not.toContain("  ");
  });
});

describe("summarizeDiaryViews", () => {
  it("summarizes only the most recent year and counts by kind", () => {
    // Mid-year, midday timestamps so the local calendar year is unambiguous
    // regardless of the test runner's timezone.
    const summary = summarizeDiaryViews([
      view({ loggedAt: "2026-08-15T12:00:00.000Z", kind: "movie" }),
      view({ loggedAt: "2026-06-15T12:00:00.000Z", kind: "book" }),
      view({ loggedAt: "2026-04-15T12:00:00.000Z", kind: "tv" }),
      // Prior year — excluded from the "most recent year" rollup.
      view({ loggedAt: "2025-06-15T12:00:00.000Z", kind: "movie" }),
    ]);

    expect(summary.year).toBe(2026);
    expect(summary.total).toBe(3);
    expect(summary.movies).toBe(1);
    expect(summary.tv).toBe(1);
    expect(summary.books).toBe(1);
  });

  it("returns a zeroed summary for an empty diary", () => {
    expect(summarizeDiaryViews([])).toEqual({
      year: 0,
      total: 0,
      movies: 0,
      tv: 0,
      books: 0,
    });
  });
});
