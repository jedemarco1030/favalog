import type { ActivityItem, List, Review } from "@/lib/types";

export const reviews: Review[] = [
  {
    id: "r_1",
    userId: "u_mira",
    mediaId: "m_afterglow",
    rating: 4.5,
    title: "A summer that never quite lands",
    body: "Salim films every kitchen like it's been abandoned for a hundred years. Astonishing sound design, and Vale is doing the quietest work of her career.",
    createdAt: "2026-07-04T18:03:00.000Z",
    likeCount: 142,
    containsSpoilers: false,
  },
  {
    id: "r_2",
    userId: "u_jules",
    mediaId: "t_northlight",
    rating: 5,
    title: "Best pilot of the year",
    body: "The best pilot I've seen in years. Ito builds a whole grammar in twenty minutes and then trusts you to keep up. Please, please stick the landing.",
    createdAt: "2026-07-12T21:44:00.000Z",
    likeCount: 287,
    containsSpoilers: false,
  },
  {
    id: "r_3",
    userId: "u_ari",
    mediaId: "b_smallhours",
    rating: 4,
    title: "Quiet on purpose",
    body: "Aro's prose is precise without being cold. I underlined half of the second act and then went back and underlined the first, too.",
    createdAt: "2026-07-19T09:15:00.000Z",
    likeCount: 61,
    containsSpoilers: false,
  },
  {
    id: "r_4",
    userId: "u_ravi",
    mediaId: "m_duneparttwo",
    rating: 4.5,
    title: "The desert as an argument",
    body: "Bigger than the first in every direction it needed to be, and smaller in the places that matter. That final act does something a lot of blockbusters won't try.",
    createdAt: "2026-07-24T20:10:00.000Z",
    likeCount: 512,
    containsSpoilers: false,
  },
  {
    id: "r_5",
    userId: "u_camille",
    mediaId: "b_bright_index",
    rating: 5,
    body: "Read the last hundred pages in one sitting on a delayed train. I don't remember the delay.",
    createdAt: "2026-07-27T08:02:00.000Z",
    likeCount: 88,
    containsSpoilers: false,
  },
  {
    id: "r_6",
    userId: "u_sana",
    mediaId: "t_harbourlines",
    rating: 4,
    title: "Slow television, in a good way",
    body: "Osei is happy to let a scene sit for a beat too long, and it works. By episode four I was checking the ferry schedule in my own city.",
    createdAt: "2026-07-29T22:18:00.000Z",
    likeCount: 74,
    containsSpoilers: false,
  },
  {
    id: "r_7",
    userId: "u_devon",
    mediaId: "m_quietsignal",
    rating: 3.5,
    body: "A better first hour than second. The premise is sharp; the resolution is a little too tidy for something this haunted.",
    createdAt: "2026-07-30T17:40:00.000Z",
    likeCount: 33,
    containsSpoilers: false,
  },
];

export const lists: List[] = [
  {
    id: "l_1",
    ownerId: "u_ari",
    title: "Long books I keep finishing on trains",
    description: "A running log. Updated whenever a station has bad Wi-Fi.",
    mediaIds: ["b_smallhours", "b_orbital_notes", "b_bright_index", "b_salt_tide"],
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    isRanked: false,
  },
  {
    id: "l_2",
    ownerId: "u_jules",
    title: "Cold-weather noirs",
    mediaIds: ["m_lowcountry", "t_northlight", "m_afterglow", "t_harbourlines"],
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    isRanked: true,
  },
];

export const activity: ActivityItem[] = [
  {
    id: "a_1",
    userId: "u_ravi",
    mediaId: "m_duneparttwo",
    kind: "reviewed",
    createdAt: "2026-08-01T20:10:00.000Z",
    rating: 4.5,
    excerpt: "Bigger than the first where it needed to be, smaller where it mattered.",
  },
  {
    id: "a_2",
    userId: "u_sana",
    mediaId: "t_harbourlines",
    kind: "finished",
    createdAt: "2026-08-01T09:24:00.000Z",
  },
  {
    id: "a_3",
    userId: "u_camille",
    mediaId: "b_bright_index",
    kind: "rated",
    createdAt: "2026-07-31T22:02:00.000Z",
    rating: 5,
  },
  {
    id: "a_4",
    userId: "u_jules",
    mediaId: "m_lowcountry",
    kind: "listed",
    createdAt: "2026-07-31T15:12:00.000Z",
  },
  {
    id: "a_5",
    userId: "u_mira",
    mediaId: "m_afterglow",
    kind: "reviewed",
    createdAt: "2026-07-30T18:03:00.000Z",
    rating: 4.5,
    excerpt: "Salim films every kitchen like it's been abandoned for a hundred years.",
  },
  {
    id: "a_6",
    userId: "u_devon",
    mediaId: "b_orbital_notes",
    kind: "started",
    createdAt: "2026-07-30T07:45:00.000Z",
  },
  {
    id: "a_7",
    userId: "u_ari",
    mediaId: "b_smallhours",
    kind: "reviewed",
    createdAt: "2026-07-29T09:15:00.000Z",
    rating: 4,
    excerpt: "Aro's prose is precise without being cold.",
  },
  {
    id: "a_8",
    userId: "u_jules",
    mediaId: "t_northlight",
    kind: "rated",
    createdAt: "2026-07-28T21:44:00.000Z",
    rating: 5,
  },
];

/**
 * Presentation-only recommendation shelves.
 *
 * These are static, hand-curated groupings used to demonstrate the "because
 * you liked X" cross-media discovery idea on the homepage. They are NOT the
 * output of a recommender — no algorithm, personalization, or ranking is
 * involved. Kept here (rather than inline in `page.tsx`) so the same shape
 * can later be produced by a real service without touching the UI.
 */
export interface RecommendationShelf {
  id: string;
  /** Media id the recommendations are anchored to. */
  seedMediaId: string;
  /** Ordered list of recommended media ids across kinds. */
  mediaIds: string[];
}

export const recommendationShelves: RecommendationShelf[] = [
  {
    id: "rec_dune",
    seedMediaId: "m_duneparttwo",
    mediaIds: [
      "m_quietsignal",
      "t_northlight",
      "b_bright_index",
      "m_thecartographer",
      "b_salt_tide",
    ],
  },
];
