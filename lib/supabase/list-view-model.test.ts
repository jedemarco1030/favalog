import { describe, expect, it } from "vitest";

import {
  normalizeStoredVisibility,
  toListDetailView,
  toListMembershipView,
  toListSummaryView,
  type ListItemRowLike,
  type ListRowLike,
} from "./list-view-model";

const baseRow: ListRowLike = {
  id: "list-1",
  slug: "alice-my-films",
  title: "My Films",
  description: null,
  visibility: "public",
  is_ranked: true,
  updated_at: "2026-08-14T00:00:00.000Z",
};

describe("normalizeStoredVisibility", () => {
  it("passes through the enum values", () => {
    expect(normalizeStoredVisibility("public")).toBe("public");
    expect(normalizeStoredVisibility("followers")).toBe("followers");
    expect(normalizeStoredVisibility("private")).toBe("private");
  });

  it("fails closed to private for an unknown value", () => {
    expect(normalizeStoredVisibility("bogus")).toBe("private");
  });
});

describe("toListSummaryView", () => {
  it("maps a row and clamps the item count to a non-negative integer", () => {
    const view = toListSummaryView({ ...baseRow, description: "hi" }, 3);
    expect(view).toEqual({
      id: "list-1",
      slug: "alice-my-films",
      title: "My Films",
      description: "hi",
      visibility: "public",
      isRanked: true,
      itemCount: 3,
      updatedAt: "2026-08-14T00:00:00.000Z",
    });
    expect(toListSummaryView(baseRow, -5).itemCount).toBe(0);
  });
});

describe("toListMembershipView", () => {
  it("carries the containsMedia flag", () => {
    expect(toListMembershipView(baseRow, 1, true).containsMedia).toBe(true);
    expect(toListMembershipView(baseRow, 1, false).containsMedia).toBe(false);
  });
});

describe("toListDetailView", () => {
  const owner = {
    username: "alice",
    display_name: "Alice",
    avatar_url: null,
  };
  const items: ListItemRowLike[] = [
    {
      media_id: "m2",
      position: 1,
      media_items: {
        slug: "low-country",
        title: "Low Country",
        year: 2019,
        kind: "movie",
        poster_url: null,
      },
    },
    {
      media_id: "m1",
      position: 0,
      media_items: {
        slug: "afterglow",
        title: "Afterglow",
        year: 2023,
        kind: "movie",
        poster_url: "/p.jpg",
      },
    },
  ];

  it("sorts items by position and resolves owner + ownership flag", () => {
    const view = toListDetailView(baseRow, owner, items, true);
    expect(view.isOwner).toBe(true);
    expect(view.owner).toEqual({
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
    });
    expect(view.items.map((i) => i.slug)).toEqual(["afterglow", "low-country"]);
    expect(view.items[0].posterUrl).toBe("/p.jpg");
    // A missing poster collapses to an empty string, never null.
    expect(view.items[1].posterUrl).toBe("");
  });

  it("does not fabricate a like count or notes on a real list", () => {
    const view = toListDetailView(baseRow, owner, [], false);
    expect(view).not.toHaveProperty("likeCount");
    expect(view.isOwner).toBe(false);
    expect(view.items).toEqual([]);
  });
});
