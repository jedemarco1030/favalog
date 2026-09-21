import { describe, expect, it } from "vitest";

import {
  mapFeedRow,
  mapFeedRows,
  shouldShowLoggedAt,
  type FeedActivityRow,
} from "./feed-view-model";

const DIARY_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_ID = "22222222-2222-4222-8222-222222222222";

function diaryRow(overrides: Partial<FeedActivityRow> = {}): FeedActivityRow {
  return {
    source: "diary",
    activity_id: DIARY_ID,
    created_at: "2026-09-13T17:47:00.123456+00:00",
    logged_at: "2026-09-13T00:00:00+00:00",
    actor_username: "mira",
    actor_display_name: "Mira Chen",
    actor_avatar_url: "https://example.test/mira.jpg",
    media_slug: "dune-part-two",
    media_title: "Dune: Part Two",
    media_year: 2024,
    media_kind: "movie",
    media_poster_url: "https://example.test/dune.jpg",
    rating: 4.5,
    is_revisit: false,
    review_id: null,
    review_title: null,
    review_body: null,
    contains_spoilers: null,
    ...overrides,
  };
}

describe("shouldShowLoggedAt", () => {
  const created = "2026-09-13T17:47:00+00:00";

  it("is false without a diary date", () => {
    expect(shouldShowLoggedAt(created, null)).toBe(false);
    expect(shouldShowLoggedAt(created, undefined)).toBe(false);
    expect(shouldShowLoggedAt(created, "")).toBe(false);
  });

  it("is false on the same UTC day as the record creation time", () => {
    expect(shouldShowLoggedAt(created, "2026-09-13T00:00:00+00:00")).toBe(
      false,
    );
  });

  it("is true for a backdated diary date", () => {
    expect(shouldShowLoggedAt(created, "2026-08-30T12:00:00+00:00")).toBe(true);
  });

  it("is false when either instant is unparseable", () => {
    expect(shouldShowLoggedAt(created, "not-a-date")).toBe(false);
    expect(shouldShowLoggedAt("not-a-date", created)).toBe(false);
  });
});

describe("mapFeedRow — diary items", () => {
  it("derives the watched verb and the diary-resolved rating", () => {
    const view = mapFeedRow(diaryRow());
    expect(view).not.toBeNull();
    expect(view?.key).toBe(`diary:${DIARY_ID}`);
    expect(view?.source).toBe("diary");
    expect(view?.action).toBe("watched");
    expect(view?.rating).toBe(4.5);
    expect(view?.review).toBeUndefined();
    expect(view?.actor).toEqual({
      username: "mira",
      displayName: "Mira Chen",
      avatarUrl: "https://example.test/mira.jpg",
    });
    expect(view?.media).toEqual({
      slug: "dune-part-two",
      title: "Dune: Part Two",
      year: 2024,
      kind: "movie",
      posterUrl: "https://example.test/dune.jpg",
    });
  });

  it("derives rewatched / read / reread from kind and is_revisit", () => {
    expect(mapFeedRow(diaryRow({ is_revisit: true }))?.action).toBe(
      "rewatched",
    );
    expect(mapFeedRow(diaryRow({ media_kind: "book" }))?.action).toBe("read");
    expect(
      mapFeedRow(diaryRow({ media_kind: "book", is_revisit: true }))?.action,
    ).toBe("reread");
    expect(mapFeedRow(diaryRow({ media_kind: "tv" }))?.action).toBe("watched");
  });

  it("embeds a linked review as ONE combined item, keeping the log verb", () => {
    const view = mapFeedRow(
      diaryRow({
        review_id: REVIEW_ID,
        review_title: "  A desert epic  ",
        review_body: "Villeneuve builds a world you can feel in your teeth.",
        contains_spoilers: true,
      }),
    );
    expect(view?.action).toBe("watched");
    expect(view?.rating).toBe(4.5);
    expect(view?.review).toEqual({
      id: REVIEW_ID,
      title: "A desert epic",
      excerpt: "Villeneuve builds a world you can feel in your teeth.",
      containsSpoilers: true,
      likeCount: 0,
      viewerHasLiked: false,
    });
  });

  it("truncates a long review body through the shared excerpt helper", () => {
    const body = `${"word ".repeat(60)}end`;
    const view = mapFeedRow(
      diaryRow({ review_id: REVIEW_ID, review_body: body }),
    );
    expect(view?.review?.excerpt.length).toBeLessThan(body.length);
    expect(view?.review?.excerpt.endsWith("\u2026")).toBe(true);
  });

  it("ignores an empty or unlinked review body", () => {
    expect(
      mapFeedRow(diaryRow({ review_id: REVIEW_ID, review_body: "   " }))
        ?.review,
    ).toBeUndefined();
    expect(
      mapFeedRow(diaryRow({ review_id: null, review_body: "Orphaned body" }))
        ?.review,
    ).toBeUndefined();
  });

  it("shows the diary date only when it differs from the creation day", () => {
    expect(mapFeedRow(diaryRow())?.loggedAt).toBeUndefined();
    expect(
      mapFeedRow(diaryRow({ logged_at: "2026-08-30T12:00:00+00:00" }))
        ?.loggedAt,
    ).toBe("2026-08-30T12:00:00+00:00");
  });

  it("omits a rating that is absent or not a half-star value", () => {
    expect(mapFeedRow(diaryRow({ rating: null }))?.rating).toBeUndefined();
    expect(mapFeedRow(diaryRow({ rating: 4.3 }))?.rating).toBeUndefined();
    expect(mapFeedRow(diaryRow({ rating: 9 }))?.rating).toBeUndefined();
  });

  it("falls back to safe values for optional identity/media fields", () => {
    const view = mapFeedRow(
      diaryRow({
        actor_display_name: null,
        actor_avatar_url: null,
        media_title: null,
        media_year: null,
        media_poster_url: null,
      }),
    );
    expect(view?.actor).toEqual({ username: "mira", displayName: "mira" });
    expect(view?.media.title).toBe("dune-part-two");
    expect(view?.media.year).toBe(0);
    expect(view?.media.posterUrl).toBe("");
  });
});

describe("mapFeedRow — standalone reviews", () => {
  function reviewRow(
    overrides: Partial<FeedActivityRow> = {},
  ): FeedActivityRow {
    return diaryRow({
      source: "review",
      activity_id: REVIEW_ID,
      logged_at: null,
      rating: 3,
      is_revisit: false,
      review_id: REVIEW_ID,
      review_title: "Second thoughts",
      review_body: "Still thinking about the ending.",
      contains_spoilers: false,
      ...overrides,
    });
  }

  it("uses the reviewed verb and its own rating", () => {
    const view = mapFeedRow(reviewRow());
    expect(view?.key).toBe(`review:${REVIEW_ID}`);
    expect(view?.source).toBe("review");
    expect(view?.action).toBe("reviewed");
    expect(view?.rating).toBe(3);
    expect(view?.loggedAt).toBeUndefined();
    expect(view?.review).toEqual({
      id: REVIEW_ID,
      title: "Second thoughts",
      excerpt: "Still thinking about the ending.",
      containsSpoilers: false,
      likeCount: 0,
      viewerHasLiked: false,
    });
  });

  it("never shows a diary date, even if one leaked into the row", () => {
    expect(
      mapFeedRow(reviewRow({ logged_at: "2026-01-01T00:00:00+00:00" }))
        ?.loggedAt,
    ).toBeUndefined();
  });

  it("omits the review title when it is blank", () => {
    expect(mapFeedRow(reviewRow({ review_title: "  " }))?.review?.title).toBe(
      undefined,
    );
  });
});

describe("mapFeedRows", () => {
  it("drops rows that could not be rendered truthfully", () => {
    const rows: FeedActivityRow[] = [
      diaryRow(),
      diaryRow({ source: "favorite" }),
      diaryRow({ activity_id: null }),
      diaryRow({ created_at: null }),
      diaryRow({ actor_username: "  " }),
      diaryRow({ media_slug: null }),
      diaryRow({ media_kind: "podcast" }),
    ];
    const views = mapFeedRows(rows);
    expect(views).toHaveLength(1);
    expect(views[0]?.key).toBe(`diary:${DIARY_ID}`);
  });

  it("returns an empty list for an empty page", () => {
    expect(mapFeedRows([])).toEqual([]);
  });
});
