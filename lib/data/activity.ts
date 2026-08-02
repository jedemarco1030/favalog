import type { ActivityItem, List, Review } from "@/lib/types";

export const reviews: Review[] = [
  {
    id: "r_1",
    userId: "u_mira",
    mediaId: "m_afterglow",
    rating: 4.5,
    title: "A summer that never quite lands",
    body: "Salim films every kitchen like it's been abandoned for a hundred years. Astonishing sound design.",
    createdAt: "2024-11-04T18:03:00.000Z",
    likeCount: 42,
    containsSpoilers: false,
  },
  {
    id: "r_2",
    userId: "u_jules",
    mediaId: "t_northlight",
    rating: 5,
    body: "The best pilot I've seen in years. Please, please stick the landing.",
    createdAt: "2024-12-12T21:44:00.000Z",
    likeCount: 137,
    containsSpoilers: false,
  },
  {
    id: "r_3",
    userId: "u_ari",
    mediaId: "b_smallhours",
    rating: 4,
    title: "Quiet on purpose",
    body: "Aro's prose is precise without being cold. I underlined half of the second act.",
    createdAt: "2025-01-19T09:15:00.000Z",
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
    mediaIds: ["b_smallhours", "b_orbital_notes", "b_bright_index"],
    createdAt: "2024-09-01T00:00:00.000Z",
    updatedAt: "2025-02-10T00:00:00.000Z",
    isRanked: false,
  },
  {
    id: "l_2",
    ownerId: "u_jules",
    title: "Cold-weather noirs",
    mediaIds: ["m_lowcountry", "t_northlight", "m_afterglow"],
    createdAt: "2024-10-14T00:00:00.000Z",
    updatedAt: "2025-01-30T00:00:00.000Z",
    isRanked: true,
  },
];

export const activity: ActivityItem[] = [
  {
    id: "a_1",
    userId: "u_mira",
    mediaId: "m_afterglow",
    kind: "reviewed",
    createdAt: "2024-11-04T18:03:00.000Z",
    rating: 4.5,
    excerpt: "Salim films every kitchen like it's been abandoned for a hundred years.",
  },
  {
    id: "a_2",
    userId: "u_jules",
    mediaId: "t_northlight",
    kind: "rated",
    createdAt: "2024-12-12T21:44:00.000Z",
    rating: 5,
  },
  {
    id: "a_3",
    userId: "u_ari",
    mediaId: "b_bright_index",
    kind: "finished",
    createdAt: "2025-02-02T14:20:00.000Z",
  },
  {
    id: "a_4",
    userId: "u_ari",
    mediaId: "b_smallhours",
    kind: "reviewed",
    createdAt: "2025-01-19T09:15:00.000Z",
    rating: 4,
    excerpt: "Aro's prose is precise without being cold.",
  },
  {
    id: "a_5",
    userId: "u_jules",
    mediaId: "m_lowcountry",
    kind: "listed",
    createdAt: "2025-01-30T00:00:00.000Z",
  },
];
