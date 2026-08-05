import { describe, expect, it } from "vitest";
import {
  currentUserId,
  favorites,
  getCurrentUser,
  getUserByUsername,
  getUserCurrentlyEnjoying,
  getUserFavorites,
  users,
} from "./users";

describe("getUserByUsername", () => {
  it("resolves the primary demo user from the stable username", () => {
    const user = getUserByUsername("jamie");
    expect(user?.id).toBe("u_ari");
    expect(user?.displayName).toBe("Jamie DeMarco");
  });

  it("returns undefined for an unknown username", () => {
    expect(getUserByUsername("does-not-exist")).toBeUndefined();
  });

  it("gives every user a unique username", () => {
    const usernames = users.map((user) => user.username);
    expect(new Set(usernames).size).toBe(usernames.length);
  });
});

describe("getCurrentUser", () => {
  it("returns the mock viewer whose profile the shell links to", () => {
    const viewer = getCurrentUser();
    expect(viewer?.id).toBe(currentUserId);
    expect(viewer?.username).toBe("jamie");
  });
});

describe("getUserFavorites", () => {
  it("resolves favorites to media in their stored order", () => {
    const items = getUserFavorites("u_ari");
    const expectedIds = favorites
      .filter((favorite) => favorite.userId === "u_ari")
      .map((favorite) => favorite.mediaId);
    expect(items.map((item) => item.id)).toEqual(expectedIds);
  });

  it("spans movies, TV, and books to show cross-format taste", () => {
    const kinds = new Set(getUserFavorites("u_ari").map((item) => item.kind));
    expect(kinds).toEqual(new Set(["movie", "tv", "book"]));
  });

  it("returns an empty list for a user with no favorites", () => {
    expect(getUserFavorites("u_nobody")).toEqual([]);
  });
});

describe("getUserCurrentlyEnjoying", () => {
  it("resolves what the demo user is watching and reading now", () => {
    const items = getUserCurrentlyEnjoying("u_ari");
    expect(items.length).toBeGreaterThan(0);
    const kinds = new Set(items.map((item) => item.kind));
    expect(kinds.has("book")).toBe(true);
    expect(kinds.has("tv") || kinds.has("movie")).toBe(true);
  });

  it("returns an empty list for a user with nothing in progress", () => {
    expect(getUserCurrentlyEnjoying("u_nobody")).toEqual([]);
  });
});
