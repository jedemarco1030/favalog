import type { List, MediaItem, User } from "@/lib/types";
import { getMediaById } from "./media";
import { getUserById } from "./users";

/**
 * Mock list / collection data.
 *
 * A `List` is a thin, cross-media record: it references its titles by
 * `mediaIds` (resolved against the catalog by the selectors below) and never
 * embeds a full `MediaItem`. A single list may freely mix movies, TV, and
 * books — there is deliberately no per-kind list system.
 *
 * There is no authentication yet, so ownership is expressed with the existing
 * mock `users`. When a real backend and sessions arrive, this module is
 * replaced by fetchers returning the same `List` shape and the selector
 * signatures stay identical.
 */
export const lists: List[] = [
  {
    id: "l_scifi",
    slug: "favorite-sci-fi",
    ownerId: "u_jules",
    title: "Favorite Sci-Fi",
    description:
      "The genre at its best across every format — desert epics, quiet first-contact, and books that read like transmissions.",
    mediaIds: [
      "m_duneparttwo",
      "t_northlight",
      "b_bright_index",
      "m_quietsignal",
      "t_signalglass",
      "b_seasofglass",
      "m_arclighthouse",
    ],
    notes: {
      m_duneparttwo: "The rare sequel that dwarfs the original.",
      t_northlight: "Builds a whole grammar in twenty minutes.",
      b_seasofglass: "Cli-fi that never once lectures you.",
    },
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    isRanked: true,
    likeCount: 1342,
    visibility: "public",
  },
  {
    id: "l_seeonce",
    slug: "movies-everyone-should-see-once",
    ownerId: "u_mira",
    title: "Movies Everyone Should See Once",
    description:
      "A short, stubborn canon. Not the greatest films ever made — the ones I keep pressing on people.",
    mediaIds: [
      "m_nightferry",
      "m_afterglow",
      "m_lowcountry",
      "m_slowmountain",
      "m_thecartographer",
      "m_duneparttwo",
    ],
    notes: {
      m_nightferry: "Six passengers, one crossing, one missing person.",
      m_slowmountain: "The last hike before the ridge is sold.",
    },
    createdAt: "2026-01-09T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    isRanked: true,
    likeCount: 2874,
    visibility: "public",
  },
  {
    id: "l_reading2026",
    slug: "books-im-reading-in-2026",
    ownerId: "u_ari",
    title: "Books I'm Reading in 2026",
    description:
      "A living shelf. Some finished, some abandoned on trains, all logged here first.",
    mediaIds: [
      "b_smallhours",
      "b_northroom",
      "b_bright_index",
      "b_salt_tide",
      "b_orbital_notes",
    ],
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    isRanked: false,
    likeCount: 96,
    visibility: "public",
  },
  {
    id: "l_comfort",
    slug: "comfort-watches",
    ownerId: "u_sana",
    title: "Comfort Watches",
    description:
      "Low stakes, warm rooms, nothing that will keep me up at night.",
    mediaIds: [
      "t_latecheckin",
      "t_undertheeaves",
      "m_paperlantern",
      "t_gildedroom",
      "m_slowmountain",
    ],
    createdAt: "2026-03-11T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    isRanked: false,
    likeCount: 512,
    visibility: "public",
  },
  {
    id: "l_changedme",
    slug: "stories-that-changed-me",
    ownerId: "u_devon",
    title: "Stories That Changed Me",
    description:
      "Books and films I can point to and say: I was one person before this and someone else after.",
    mediaIds: [
      "b_paperbirds",
      "b_orbital_notes",
      "m_afterglow",
      "t_harbourlines",
      "b_theslowdial",
    ],
    notes: {
      b_paperbirds: "Every fold is a small elegy.",
    },
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
    isRanked: true,
    likeCount: 738,
    visibility: "public",
  },
  {
    id: "l_noirs",
    slug: "cold-weather-noirs",
    ownerId: "u_jules",
    title: "Cold-weather noirs",
    description: "For grey afternoons. Ranked by how long the dread lingers.",
    mediaIds: ["m_lowcountry", "t_northlight", "m_afterglow", "t_harbourlines"],
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    isRanked: true,
    likeCount: 264,
    visibility: "public",
  },
  {
    id: "l_trains",
    slug: "long-books-on-trains",
    ownerId: "u_ari",
    title: "Long books I keep finishing on trains",
    description: "A running log. Updated whenever a station has bad Wi-Fi.",
    mediaIds: [
      "b_smallhours",
      "b_orbital_notes",
      "b_bright_index",
      "b_salt_tide",
    ],
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    isRanked: false,
    likeCount: 143,
    visibility: "public",
  },
  {
    id: "l_binge",
    slug: "series-worth-the-binge",
    ownerId: "u_ravi",
    title: "Series worth the binge",
    description:
      "Shows that reward two-a-night discipline. Completionist-approved.",
    mediaIds: [
      "t_northlight",
      "t_harbourlines",
      "t_signalglass",
      "t_paperwatch",
      "t_gildedroom",
      "t_ridgeandriver",
    ],
    createdAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    isRanked: true,
    likeCount: 401,
    visibility: "public",
  },
  {
    id: "l_quiet",
    slug: "quiet-slow-perfect",
    ownerId: "u_camille",
    title: "Quiet, slow, perfect",
    description: "Three that trust you to sit still.",
    mediaIds: ["m_slowmountain", "b_quietinstruments", "t_latecheckin"],
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    isRanked: false,
    likeCount: 187,
    visibility: "public",
  },
  {
    id: "l_rewatch",
    slug: "the-one-i-rewatch-most",
    ownerId: "u_ravi",
    title: "The one I rewatch most",
    description: "A list of exactly one. It earns the space.",
    mediaIds: ["m_duneparttwo"],
    createdAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    isRanked: false,
    likeCount: 58,
    visibility: "public",
  },
];

/**
 * Ids of lists hand-picked by the Favalog editorial team. Curation lives in
 * the data layer because there is not enough real signal in the mock catalog
 * to derive a "featured" set. Order is meaningful.
 */
const featuredListIds: readonly string[] = [
  "l_seeonce",
  "l_scifi",
  "l_changedme",
] as const;

/**
 * The mock viewer's "circle" — the owners whose lists show up under
 * "From your circle". Mirrors the social-graph idea used elsewhere without a
 * real follow model. Keyed by owner so a list joins the section automatically.
 */
const circleOwnerIds: readonly string[] = ["u_ari", "u_jules", "u_camille"];

/** Every list. Order here is not significant — selectors sort as needed. */
export function getLists(): List[] {
  return lists;
}

/** Resolve a list by its stable slug, or `undefined` for an unknown slug. */
export function getListBySlug(slug: string): List | undefined {
  return lists.find((list) => list.slug === slug);
}

/** Resolve a list by id. Kept for consumers that only hold an id. */
export function getListById(id: string): List | undefined {
  return lists.find((list) => list.id === id);
}

/** Lists authored by a user, most recently updated first. */
export function getListsByUser(userId: string): List[] {
  return lists
    .filter((list) => list.ownerId === userId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** The list's owner, resolved against the mock user layer. */
export function getListOwner(list: List): User | undefined {
  return getUserById(list.ownerId);
}

/**
 * Resolve a list's ordered contents into full `MediaItem`s. Missing ids are
 * skipped so a stale reference can never crash a render, and the original
 * order (which doubles as the ranking for ranked lists) is preserved.
 */
export function getListMedia(list: List): MediaItem[] {
  return list.mediaIds
    .map((id) => getMediaById(id))
    .filter((item): item is MediaItem => Boolean(item));
}

/** The curator's note for a single title in a list, if one exists. */
export function getListItemNote(
  list: List,
  mediaId: string,
): string | undefined {
  return list.notes?.[mediaId];
}

/** Most-liked lists first. */
export function getPopularLists(limit = lists.length): List[] {
  return [...lists].sort((a, b) => b.likeCount - a.likeCount).slice(0, limit);
}

/** Most recently updated lists first. */
export function getRecentlyUpdatedLists(limit = lists.length): List[] {
  return [...lists]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, limit);
}

/** Editorial "staff picks", in curated order. */
export function getFeaturedLists(): List[] {
  return featuredListIds
    .map((id) => getListById(id))
    .filter((list): list is List => Boolean(list));
}

/** Lists authored by people in the mock viewer's circle, newest first. */
export function getListsFromCircle(limit = lists.length): List[] {
  return [...lists]
    .filter((list) => circleOwnerIds.includes(list.ownerId))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, limit);
}

/**
 * The searchable strings for a list: its title, description, and its owner's
 * display name and handle. Kept in the data layer so the discovery UI never
 * has to know that a creator is resolved from a separate user record.
 */
export function listSearchTermsFor(list: List): string[] {
  const terms: string[] = [list.title];
  if (list.description) terms.push(list.description);
  const owner = getListOwner(list);
  if (owner) terms.push(owner.displayName, owner.handle);
  return terms;
}
