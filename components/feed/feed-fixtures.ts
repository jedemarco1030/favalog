import type { FeedActivityView } from "@/lib/supabase/feed-view-model";

/**
 * Shared, deterministic feed items for component tests and Storybook.
 *
 * Kept in a plain module (no test-only imports) so the stories and the tests
 * demonstrate exactly the same shapes the real reader produces.
 */

export const diaryItem: FeedActivityView = {
  key: "diary:11111111-1111-1111-1111-111111111111",
  source: "diary",
  createdAt: "2026-09-10T18:30:00.000Z",
  actor: { username: "mira", displayName: "Mira Chen" },
  media: {
    slug: "afterglow",
    title: "Afterglow",
    year: 2024,
    kind: "movie",
    posterUrl: "/media/posters/afterglow.svg",
  },
  action: "watched",
  rating: 4.5,
};

export const diaryWithReviewItem: FeedActivityView = {
  key: "diary:22222222-2222-2222-2222-222222222222",
  source: "diary",
  createdAt: "2026-09-09T09:05:00.000Z",
  loggedAt: "2026-08-30T00:00:00.000Z",
  actor: { username: "jamie", displayName: "Jamie Rivera" },
  media: {
    slug: "the-long-quiet",
    title: "The Long Quiet",
    year: 2023,
    kind: "book",
    posterUrl: "/media/posters/thecartographer.svg",
  },
  action: "read",
  rating: 5,
  review: {
    id: "33333333-3333-3333-3333-333333333333",
    title: "Patient and devastating",
    excerpt: "It takes its time, and every page of that time is earned.",
    containsSpoilers: false,
    likeCount: 3,
    viewerHasLiked: false,
  },
};

export const standaloneReviewItem: FeedActivityView = {
  key: "review:44444444-4444-4444-4444-444444444444",
  source: "review",
  createdAt: "2026-09-08T21:15:00.000Z",
  actor: { username: "sam", displayName: "Sam Okafor" },
  media: {
    slug: "northern-lights",
    title: "Northern Lights",
    year: 2022,
    kind: "tv",
    posterUrl: "",
  },
  action: "reviewed",
  review: {
    id: "55555555-5555-5555-5555-555555555555",
    excerpt: "The finale recontextualises the whole first season.",
    containsSpoilers: true,
    likeCount: 12,
    viewerHasLiked: true,
  },
};

export const rewatchItem: FeedActivityView = {
  key: "diary:66666666-6666-6666-6666-666666666666",
  source: "diary",
  createdAt: "2026-09-07T12:00:00.000Z",
  actor: { username: "mira", displayName: "Mira Chen" },
  media: {
    slug: "afterglow",
    title: "Afterglow",
    year: 2024,
    kind: "movie",
    posterUrl: "/media/posters/afterglow.svg",
  },
  action: "rewatched",
  rating: 5,
};
