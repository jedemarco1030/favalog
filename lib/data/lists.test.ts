import { describe, expect, it } from "vitest";
import type { List } from "@/lib/types";
import {
  getFeaturedLists,
  getListById,
  getListBySlug,
  getListItemNote,
  getListMedia,
  getListOwner,
  getLists,
  getListsByUser,
  getListsFromCircle,
  getPopularLists,
  getRecentlyUpdatedLists,
  lists,
  listSearchTermsFor,
} from "./lists";

describe("getListBySlug", () => {
  it("resolves a valid slug to the matching list", () => {
    const list = getListBySlug("favorite-sci-fi");
    expect(list?.id).toBe("l_scifi");
    expect(list?.title).toBe("Favorite Sci-Fi");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getListBySlug("no-such-list")).toBeUndefined();
  });
});

describe("getListById", () => {
  it("resolves a known id and misses gracefully", () => {
    expect(getListById("l_scifi")?.slug).toBe("favorite-sci-fi");
    expect(getListById("l_nope")).toBeUndefined();
  });
});

describe("getListMedia", () => {
  it("resolves ids to items and preserves list order", () => {
    const list = getListBySlug("favorite-sci-fi")!;
    const media = getListMedia(list);
    expect(media.map((item) => item.id)).toEqual(list.mediaIds);
  });

  it("supports mixed-media lists across every kind", () => {
    const list = getListBySlug("favorite-sci-fi")!;
    const kinds = new Set(getListMedia(list).map((item) => item.kind));
    expect(kinds.has("movie")).toBe(true);
    expect(kinds.has("tv")).toBe(true);
    expect(kinds.has("book")).toBe(true);
  });

  it("skips ids that do not resolve to a catalog item", () => {
    const orphaned: List = {
      id: "l_test",
      slug: "test",
      ownerId: "u_ari",
      title: "Test",
      mediaIds: ["m_afterglow", "m_does_not_exist", "b_smallhours"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      isRanked: false,
      likeCount: 0,
    };
    expect(getListMedia(orphaned).map((item) => item.id)).toEqual([
      "m_afterglow",
      "b_smallhours",
    ]);
  });
});

describe("getListItemNote", () => {
  it("returns a curator note when present and undefined otherwise", () => {
    const list = getListBySlug("favorite-sci-fi")!;
    expect(getListItemNote(list, "m_duneparttwo")).toMatch(/sequel/i);
    expect(getListItemNote(list, "m_quietsignal")).toBeUndefined();
  });
});

describe("getListsByUser", () => {
  it("returns only that user's lists, newest updated first", () => {
    const ariLists = getListsByUser("u_ari");
    expect(ariLists.length).toBeGreaterThan(1);
    expect(ariLists.every((list) => list.ownerId === "u_ari")).toBe(true);
    const updated = ariLists.map((list) => list.updatedAt);
    expect(updated).toEqual([...updated].sort((a, b) => (a < b ? 1 : -1)));
  });

  it("returns an empty list for an unknown user", () => {
    expect(getListsByUser("u_nobody")).toEqual([]);
  });
});

describe("getListOwner", () => {
  it("resolves the owner of a list", () => {
    const list = getListBySlug("favorite-sci-fi")!;
    expect(getListOwner(list)?.id).toBe("u_jules");
  });
});

describe("getPopularLists", () => {
  it("orders by like count descending and honors the limit", () => {
    const popular = getPopularLists(3);
    expect(popular).toHaveLength(3);
    const likes = popular.map((list) => list.likeCount);
    expect(likes).toEqual([...likes].sort((a, b) => b - a));
    expect(likes[0]).toBe(Math.max(...lists.map((list) => list.likeCount)));
  });
});

describe("getRecentlyUpdatedLists", () => {
  it("orders by updatedAt descending", () => {
    const recent = getRecentlyUpdatedLists();
    const updated = recent.map((list) => list.updatedAt);
    expect(updated).toEqual([...updated].sort((a, b) => (a < b ? 1 : -1)));
  });
});

describe("getFeaturedLists", () => {
  it("returns the curated staff picks in curated order", () => {
    expect(getFeaturedLists().map((list) => list.id)).toEqual([
      "l_seeonce",
      "l_scifi",
      "l_changedme",
    ]);
  });
});

describe("getListsFromCircle", () => {
  it("only returns lists from circle owners, newest first", () => {
    const circle = new Set(["u_ari", "u_jules", "u_camille"]);
    const fromCircle = getListsFromCircle();
    expect(fromCircle.length).toBeGreaterThan(0);
    expect(fromCircle.every((list) => circle.has(list.ownerId))).toBe(true);
    const updated = fromCircle.map((list) => list.updatedAt);
    expect(updated).toEqual([...updated].sort((a, b) => (a < b ? 1 : -1)));
  });
});

describe("listSearchTermsFor", () => {
  it("includes the title, description, and the creator's name and username", () => {
    const list = getListBySlug("favorite-sci-fi")!;
    const terms = listSearchTermsFor(list);
    expect(terms).toContain("Favorite Sci-Fi");
    expect(terms.some((term) => term.includes("desert epics"))).toBe(true);
    expect(terms).toContain("Jules Marchetti");
    expect(terms).toContain("jules");
  });
});

describe("getLists", () => {
  it("exposes every mock list", () => {
    expect(getLists()).toBe(lists);
    expect(getLists().length).toBeGreaterThanOrEqual(8);
    // Every slug is unique so route identity stays stable.
    const slugs = getLists().map((list) => list.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
