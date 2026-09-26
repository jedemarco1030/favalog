import { describe, expect, it } from "vitest";
import type { MediaItem } from "@/lib/types";
import {
  classifyRelease,
  releaseLabel,
  releaseWindowStartYear,
  selectReleaseShelf,
} from "./releases";
import { pickFeatured, utcDayIndex } from "./featured";

function item(
  slug: string,
  year: number,
  extra: Partial<Pick<MediaItem, "backdropUrl" | "kind">> = {},
): MediaItem {
  return {
    id: `id-${slug}`,
    slug,
    kind: extra.kind ?? "book",
    title: slug,
    synopsis: "",
    year,
    posterUrl: "",
    backdropUrl: extra.backdropUrl,
    genres: [],
    authors: [],
    pageCount: 0,
  } as MediaItem;
}

describe("classifyRelease", () => {
  const now = 2026;
  it("treats a future year as upcoming", () => {
    expect(classifyRelease(2027, now)).toBe("upcoming");
  });
  it("does not claim a current-year title is released", () => {
    expect(classifyRelease(2026, now)).toBe("this-year");
  });
  it("counts the two previous years as released and recent", () => {
    expect(classifyRelease(2025, now)).toBe("released");
    expect(classifyRelease(2024, now)).toBe("released");
    expect(classifyRelease(2023, now)).toBe("older");
  });
  it("marks missing or malformed years unknown", () => {
    expect(classifyRelease(0, now)).toBe("unknown");
    expect(classifyRelease(-5, now)).toBe("unknown");
    expect(classifyRelease(2025.5, now)).toBe("unknown");
    expect(classifyRelease(Number.NaN, now)).toBe("unknown");
  });
  it("bounds the read window", () => {
    expect(releaseWindowStartYear(now)).toBe(2024);
  });
});

describe("releaseLabel", () => {
  it("labels each status without implying day precision", () => {
    expect(releaseLabel(2027, 2026)).toBe("Upcoming · 2027");
    expect(releaseLabel(2026, 2026)).toBe("2026 · This year");
    expect(releaseLabel(2025, 2026)).toBe("Released 2025");
    expect(releaseLabel(2010, 2026)).toBeNull();
    expect(releaseLabel(0, 2026)).toBeNull();
  });
});

describe("selectReleaseShelf", () => {
  it("drops older and undated titles regardless of import order", () => {
    // Input order mimics recently-imported-first; an old import must not appear.
    const shelf = selectReleaseShelf(
      [item("old-import", 1965), item("undated", 0), item("fresh", 2025)],
      2026,
    );
    expect(shelf.recent.map((i) => i.slug)).toEqual(["fresh"]);
    expect(shelf.upcoming).toEqual([]);
  });

  it("orders recent newest-first and upcoming soonest-first, stably", () => {
    const shelf = selectReleaseShelf(
      [
        item("a-2024", 2024),
        item("b-2026", 2026),
        item("c-2028", 2028),
        item("d-2027", 2027),
        item("e-2024", 2024),
      ],
      2026,
    );
    expect(shelf.recent.map((i) => i.slug)).toEqual([
      "b-2026",
      "a-2024",
      "e-2024",
    ]);
    expect(shelf.upcoming.map((i) => i.slug)).toEqual(["d-2027", "c-2028"]);
  });

  it("respects the limit across both groups", () => {
    const shelf = selectReleaseShelf(
      [item("u", 2027), item("r1", 2025), item("r2", 2025)],
      2026,
      2,
    );
    expect(shelf.upcoming).toHaveLength(1);
    expect(shelf.recent).toHaveLength(1);
  });
});

describe("pickFeatured", () => {
  const art = "https://media.rawg.io/media/x.jpg";

  it("prefers curated titles with backdrop artwork", () => {
    const pick = pickFeatured(
      [
        item("plain", 2020, { backdropUrl: art }),
        item("curated-no-art", 2020),
        item("curated-art", 2020, { backdropUrl: art }),
      ],
      0,
      ["curated-no-art", "curated-art"],
    );
    expect(pick).toEqual({
      item: expect.objectContaining({ slug: "curated-art" }),
      curated: true,
    });
  });

  it("skips curated slugs missing from the catalog", () => {
    const pick = pickFeatured([item("present", 2020)], 3, [
      "missing",
      "present",
    ]);
    expect(pick?.item.slug).toBe("present");
    expect(pick?.curated).toBe(true);
  });

  it("falls back to an uncurated title and says so", () => {
    const pick = pickFeatured(
      [item("x", 2020), item("y", 2020, { backdropUrl: art })],
      0,
      [],
    );
    expect(pick).toEqual({
      item: expect.objectContaining({ slug: "y" }),
      curated: false,
    });
  });

  it("rotates once per UTC day within the pool", () => {
    const pool = [
      item("one", 2020, { backdropUrl: art }),
      item("two", 2020, { backdropUrl: art }),
    ];
    const slugs = ["one", "two"];
    expect(pickFeatured(pool, 0, slugs)?.item.slug).toBe("one");
    expect(pickFeatured(pool, 1, slugs)?.item.slug).toBe("two");
    expect(pickFeatured(pool, 2, slugs)?.item.slug).toBe("one");
    expect(pickFeatured(pool, -1, slugs)?.item.slug).toBe("two");
  });

  it("returns null for an empty catalog", () => {
    expect(pickFeatured([], 0)).toBeNull();
  });

  it("derives the day index from UTC", () => {
    expect(utcDayIndex(new Date("1970-01-02T23:59:59Z"))).toBe(1);
    expect(utcDayIndex(new Date("1970-01-03T00:00:00Z"))).toBe(2);
  });
});
