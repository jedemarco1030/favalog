import type { CurrentlyEnjoying, Favorite, MediaItem, User } from "@/lib/types";
import { getMediaById } from "./media";

/**
 * Mock user data.
 *
 * There is no authentication yet, so the app has a single mock "current
 * viewer" — Jamie DeMarco (`currentUserId`) — whose diary, reviews, lists,
 * favorites, and activity make up the primary `/profile/jamie` demo. The
 * remaining users are community members who appear on reviews, lists, and the
 * social feed. Identity fields (username, displayName, bio, location,
 * joinedAt, follower/following counts) are stored here; profile *statistics*
 * are derived elsewhere from diary/reviews/lists so the two never drift.
 *
 * `id` values are opaque, stable references and never surface in the UI or in
 * URLs (routes key off `username`). `u_ari` is the primary demo user; its
 * public identity is Jamie DeMarco.
 */
export const users: User[] = [
  {
    id: "u_ari",
    username: "jamie",
    displayName: "Jamie DeMarco",
    avatarUrl: "/media/avatars/jamie.svg",
    bio: "Software engineer, hockey fan, movie watcher, book reader, and lifelong collector of stories.",
    location: "Boston, MA",
    joinedAt: "2024-03-12T00:00:00.000Z",
    followerCount: 1284,
    followingCount: 312,
  },
  {
    id: "u_mira",
    username: "mira",
    displayName: "Mira Bhatt",
    avatarUrl: "/media/avatars/mira.svg",
    bio: "Film school dropout. Print-first. Coffee-second.",
    location: "Lisbon, Portugal",
    joinedAt: "2023-11-02T00:00:00.000Z",
    followerCount: 908,
    followingCount: 201,
  },
  {
    id: "u_jules",
    username: "jules",
    displayName: "Jules Marchetti",
    avatarUrl: "/media/avatars/jules.svg",
    bio: "Notes from the couch. Sci-fi, noir, and long trilogies.",
    location: "Turin, Italy",
    joinedAt: "2022-06-18T00:00:00.000Z",
    followerCount: 3421,
    followingCount: 187,
  },
  {
    id: "u_sana",
    username: "sana",
    displayName: "Sana Iyer",
    avatarUrl: "/media/avatars/sana.svg",
    bio: "Reads on the train. Watches at 1x. No skipping intros.",
    joinedAt: "2024-01-20T00:00:00.000Z",
    followerCount: 612,
    followingCount: 240,
  },
  {
    id: "u_ravi",
    username: "ravi",
    displayName: "Ravi Menon",
    avatarUrl: "/media/avatars/ravi.svg",
    bio: "Series completionist. Currently rationing the finale.",
    location: "Bengaluru, India",
    joinedAt: "2023-04-09T00:00:00.000Z",
    followerCount: 2015,
    followingCount: 143,
  },
  {
    id: "u_camille",
    username: "camille",
    displayName: "Camille Roux",
    avatarUrl: "/media/avatars/camille.svg",
    bio: "Bookshops on holiday. Cinemas on Tuesdays.",
    location: "Lyon, France",
    joinedAt: "2023-08-30T00:00:00.000Z",
    followerCount: 774,
    followingCount: 302,
  },
  {
    id: "u_devon",
    username: "devon",
    displayName: "Devon Halle",
    avatarUrl: "/media/avatars/devon.svg",
    bio: "Essays, essays, essays. And the occasional slow film.",
    joinedAt: "2022-12-15T00:00:00.000Z",
    followerCount: 1892,
    followingCount: 220,
  },
];

/**
 * The single mock "current viewer" for the MVP. Used to decide when a profile
 * is the viewer's own (e.g. to show the presentation-only Edit profile
 * action) and to point the app-shell avatar at the right `/profile/[username]`.
 * When real authentication arrives this is replaced by the session user.
 */
export const currentUserId = "u_ari";

/**
 * A person's favorites: a deliberate, ordered, cross-media shelf. Stored as
 * thin `mediaId` references (never embedded media) so favorites can never
 * drift from the catalog. Array order is the display order.
 */
export const favorites: Favorite[] = [
  { userId: "u_ari", mediaId: "m_duneparttwo" },
  { userId: "u_ari", mediaId: "t_northlight" },
  { userId: "u_ari", mediaId: "b_northroom" },
  { userId: "u_ari", mediaId: "m_afterglow" },
  { userId: "u_ari", mediaId: "b_bright_index" },
  { userId: "u_ari", mediaId: "t_harbourlines" },
];

/**
 * What each user is watching or reading right now. A lightweight status hint
 * for the profile — the verb is derived from media kind, so there is no
 * progress state to maintain.
 */
export const currentlyEnjoying: CurrentlyEnjoying[] = [
  { userId: "u_ari", mediaId: "t_signalglass" },
  { userId: "u_ari", mediaId: "b_orbital_notes" },
];

export function getUserById(id: string): User | undefined {
  return users.find((user) => user.id === id);
}

/**
 * Resolve a user by their stable `username`, or `undefined` for an unknown
 * one. Backs the `/profile/[username]` route, which calls `notFound()` on a
 * miss.
 */
export function getUserByUsername(username: string): User | undefined {
  return users.find((user) => user.username === username);
}

/** The mock current viewer, or `undefined` if it cannot be resolved. */
export function getCurrentUser(): User | undefined {
  return getUserById(currentUserId);
}

/**
 * A user's favorite titles, resolved to full `MediaItem`s in their stored
 * (deliberate) order. Missing ids are skipped so a stale reference can never
 * crash a render.
 */
export function getUserFavorites(userId: string): MediaItem[] {
  return favorites
    .filter((favorite) => favorite.userId === userId)
    .map((favorite) => getMediaById(favorite.mediaId))
    .filter((item): item is MediaItem => Boolean(item));
}

/**
 * The titles a user is currently watching or reading, resolved to full
 * `MediaItem`s. Missing ids are skipped.
 */
export function getUserCurrentlyEnjoying(userId: string): MediaItem[] {
  return currentlyEnjoying
    .filter((entry) => entry.userId === userId)
    .map((entry) => getMediaById(entry.mediaId))
    .filter((item): item is MediaItem => Boolean(item));
}
