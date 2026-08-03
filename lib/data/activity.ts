import type {
  ActivityItem,
  List,
  MediaItem,
  RatingDistribution,
  Review,
} from "@/lib/types";
import { getMediaById, mediaItems } from "./media";

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
  {
    id: "r_8",
    userId: "u_ari",
    mediaId: "t_harbourlines",
    rating: 4,
    title: "A logbook of a show",
    body: "Watched two a night for a week. It rewards patience — by the finale the dispatcher's ledger felt like my own.",
    createdAt: "2026-06-22T21:10:00.000Z",
    likeCount: 47,
    containsSpoilers: false,
  },
  {
    id: "r_9",
    userId: "u_ari",
    mediaId: "b_bright_index",
    rating: 4.5,
    title: "Catalogues that read like spells",
    body: "Aldana turns a defunded archive into the most hopeful place on the page. I finished it and immediately reshelved my own books.",
    createdAt: "2026-05-09T08:40:00.000Z",
    likeCount: 39,
    containsSpoilers: false,
  },
  {
    id: "r_10",
    userId: "u_ari",
    mediaId: "m_afterglow",
    rating: 4,
    body: "A second watch. Quieter than I remembered, and better for it.",
    createdAt: "2026-03-30T19:55:00.000Z",
    likeCount: 21,
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
  {
    id: "rec_afterglow",
    seedMediaId: "m_afterglow",
    mediaIds: [
      "m_nightferry",
      "b_smallhours",
      "t_harbourlines",
      "m_slowmountain",
      "b_salt_tide",
    ],
  },
  {
    id: "rec_northlight",
    seedMediaId: "t_northlight",
    mediaIds: [
      "t_signalglass",
      "m_quietsignal",
      "b_bright_index",
      "m_arclighthouse",
      "b_seasofglass",
    ],
  },
  {
    id: "rec_smallhours",
    seedMediaId: "b_smallhours",
    mediaIds: [
      "b_northroom",
      "m_afterglow",
      "t_harbourlines",
      "b_salt_tide",
      "m_lowcountry",
    ],
  },
  {
    id: "rec_bright_index",
    seedMediaId: "b_bright_index",
    mediaIds: [
      "b_seasofglass",
      "t_signalglass",
      "m_thecartographer",
      "b_orbital_notes",
      "m_quietsignal",
    ],
  },
  {
    id: "rec_harbourlines",
    seedMediaId: "t_harbourlines",
    mediaIds: [
      "m_nightferry",
      "b_salt_tide",
      "t_paperwatch",
      "m_lowcountry",
      "b_smallhours",
    ],
  },
];

/**
 * Returns reviews associated with a specific media item, newest first.
 * Kept in the data layer so the UI never has to know the underlying array
 * ordering.
 */
export function getReviewsForMedia(mediaId: string): Review[] {
  return reviews
    .filter((review) => review.mediaId === mediaId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Look up a single review by id. Kept in the data layer so consumers that
 * only hold a `reviewId` (such as diary entries) never touch the raw array. */
export function getReviewById(id: string): Review | undefined {
  return reviews.find((review) => review.id === id);
}

/**
 * Related titles for a media item, drawn from curated `recommendationShelves`
 * when available and otherwise a deterministic fallback across kinds.
 *
 * Related titles intentionally may span movie / tv / book — that cross-media
 * discovery is a core Favalog product idea.
 */
export function getRelatedMedia(mediaId: string, limit = 6): MediaItem[] {
  const shelf = recommendationShelves.find((s) => s.seedMediaId === mediaId);
  const seedIds: string[] = shelf ? [...shelf.mediaIds] : [];

  if (seedIds.length < limit) {
    // Deterministic fallback: same-genre neighbours, then anything else,
    // always excluding the item itself and anything already picked.
    const seed = getMediaById(mediaId);
    const seedGenres = new Set(seed?.genres ?? []);
    const remainder = mediaItems
      .filter((item) => item.id !== mediaId && !seedIds.includes(item.id))
      .sort((a, b) => {
        const aShared = a.genres.some((g) => seedGenres.has(g)) ? 1 : 0;
        const bShared = b.genres.some((g) => seedGenres.has(g)) ? 1 : 0;
        if (aShared !== bShared) return bShared - aShared;
        return (b.averageRating ?? 0) - (a.averageRating ?? 0);
      });
    for (const item of remainder) {
      if (seedIds.length >= limit) break;
      seedIds.push(item.id);
    }
  }

  return seedIds
    .slice(0, limit)
    .map((id) => getMediaById(id))
    .filter((item): item is MediaItem => Boolean(item));
}

/**
 * Deterministic mock rating distribution for a media item.
 *
 * We do not carry per-user rating rows in the mock catalog, so this synthesises
 * a plausible-looking histogram from the item's `averageRating`. The result is
 * stable for a given media id so snapshots stay reproducible. If a media item
 * has no `averageRating`, we return `undefined` and the UI omits the section.
 */
export function getRatingDistribution(
  mediaId: string,
): RatingDistribution | undefined {
  const item = getMediaById(mediaId);
  if (!item || item.averageRating == null) return undefined;

  // Deterministic pseudo-random count from the id, roughly 80–1200 ratings.
  let hash = 0;
  for (let i = 0; i < mediaId.length; i++) {
    hash = (hash * 31 + mediaId.charCodeAt(i)) | 0;
  }
  const count = 80 + (Math.abs(hash) % 1120);

  // Build a bell-ish distribution centred on the rounded average.
  const center = Math.min(5, Math.max(1, Math.round(item.averageRating)));
  const weights: [number, number, number, number, number] = [1, 1, 1, 1, 1];
  for (let star = 1; star <= 5; star++) {
    const distance = Math.abs(star - center);
    // Base weight falls off with distance; skew slightly toward the average.
    weights[star - 1] = Math.max(0.02, 1 / Math.pow(distance + 1, 1.8));
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / weightSum) * count);
  const rounded = raw.map((n) => Math.round(n));
  // Adjust rounding drift so buckets sum exactly to `count`.
  const drift = count - rounded.reduce((a, b) => a + b, 0);
  const centerIdx = center - 1;
  rounded[centerIdx] += drift;

  return {
    mediaId,
    count,
    average: item.averageRating,
    buckets: rounded as [number, number, number, number, number],
  };
}
