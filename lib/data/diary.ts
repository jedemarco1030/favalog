import type { DiaryEntry, MediaItem, MediaKind } from "@/lib/types";
import { getMediaById } from "./media";

/**
 * Mock diary / log-entry data.
 *
 * A diary entry is a thin log row: it references a `MediaItem` by `mediaId`
 * (never embedding the full media object) and an optional `Review` by
 * `reviewId` (never duplicating the review body). Resolving those references
 * is the job of the selectors below, so the UI layer never reaches into the
 * raw catalog or review arrays directly.
 *
 * There is no authentication yet, so the app has a single mock diary owner.
 * When a real backend and sessions arrive, `diaryOwnerId` is replaced by the
 * authenticated user id and `diaryEntries` becomes a per-user query — the
 * `DiaryEntry` shape and every selector signature stay identical.
 */
export const diaryOwnerId = "u_ari";

/**
 * A deterministic activity history spanning several months of 2026 for the
 * mock diary owner. Deliberately varied: movies, TV, and books coexist; some
 * entries are rated and some are not; some carry a review and most do not.
 * Ordering here is not significant — selectors sort by `loggedAt`.
 */
export const diaryEntries: DiaryEntry[] = [
  {
    id: "d_01",
    userId: diaryOwnerId,
    mediaId: "m_duneparttwo",
    loggedAt: "2026-08-02T21:30:00.000Z",
    action: "watched",
    rating: 4.5,
  },
  {
    id: "d_02",
    userId: diaryOwnerId,
    mediaId: "b_northroom",
    loggedAt: "2026-08-01T08:15:00.000Z",
    action: "reread",
    rating: 4.5,
  },
  {
    id: "d_03",
    userId: diaryOwnerId,
    mediaId: "t_latecheckin",
    loggedAt: "2026-07-28T22:05:00.000Z",
    action: "watched",
    rating: 4,
  },
  {
    id: "d_04",
    userId: diaryOwnerId,
    mediaId: "b_smallhours",
    loggedAt: "2026-07-19T09:15:00.000Z",
    action: "read",
    rating: 4,
    reviewId: "r_3",
  },
  {
    id: "d_05",
    userId: diaryOwnerId,
    mediaId: "m_nightferry",
    loggedAt: "2026-07-11T20:40:00.000Z",
    action: "watched",
    rating: 4.5,
  },
  {
    id: "d_06",
    userId: diaryOwnerId,
    mediaId: "t_paperwatch",
    loggedAt: "2026-06-30T21:50:00.000Z",
    action: "watched",
  },
  {
    id: "d_07",
    userId: diaryOwnerId,
    mediaId: "t_harbourlines",
    loggedAt: "2026-06-22T21:10:00.000Z",
    action: "watched",
    rating: 4,
    reviewId: "r_8",
  },
  {
    id: "d_08",
    userId: diaryOwnerId,
    mediaId: "b_salt_tide",
    loggedAt: "2026-06-08T07:30:00.000Z",
    action: "read",
    rating: 4,
  },
  {
    id: "d_09",
    userId: diaryOwnerId,
    mediaId: "m_quietsignal",
    loggedAt: "2026-05-24T19:20:00.000Z",
    action: "watched",
    rating: 3.5,
  },
  {
    id: "d_10",
    userId: diaryOwnerId,
    mediaId: "b_bright_index",
    loggedAt: "2026-05-09T08:40:00.000Z",
    action: "read",
    rating: 4.5,
    reviewId: "r_9",
  },
  {
    id: "d_11",
    userId: diaryOwnerId,
    mediaId: "t_northlight",
    loggedAt: "2026-04-27T22:15:00.000Z",
    action: "watched",
    rating: 5,
  },
  {
    id: "d_12",
    userId: diaryOwnerId,
    mediaId: "b_paperbirds",
    loggedAt: "2026-04-14T07:05:00.000Z",
    action: "read",
  },
  {
    id: "d_13",
    userId: diaryOwnerId,
    mediaId: "m_afterglow",
    loggedAt: "2026-03-30T19:55:00.000Z",
    action: "rewatched",
    rating: 4,
    reviewId: "r_10",
  },
  {
    id: "d_14",
    userId: diaryOwnerId,
    mediaId: "m_slowmountain",
    loggedAt: "2026-03-15T18:30:00.000Z",
    action: "watched",
    rating: 4.5,
  },
  {
    id: "d_15",
    userId: diaryOwnerId,
    mediaId: "b_orbital_notes",
    loggedAt: "2026-02-28T09:45:00.000Z",
    action: "read",
    rating: 4,
  },
  {
    id: "d_16",
    userId: diaryOwnerId,
    mediaId: "t_undertheeaves",
    loggedAt: "2026-02-11T21:00:00.000Z",
    action: "watched",
    rating: 4,
  },
  {
    id: "d_17",
    userId: diaryOwnerId,
    mediaId: "m_lowcountry",
    loggedAt: "2026-01-24T20:10:00.000Z",
    action: "watched",
    rating: 4,
  },
  {
    id: "d_18",
    userId: diaryOwnerId,
    mediaId: "b_theslowdial",
    loggedAt: "2026-01-09T08:20:00.000Z",
    action: "read",
  },
];

/** Diary entries for a user, newest first. Defaults to the mock owner. */
export function getDiaryEntriesForUser(
  userId: string = diaryOwnerId,
): DiaryEntry[] {
  return diaryEntries
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
}

/**
 * Resolve the `MediaItem` a diary entry points at. Returns `undefined` if the
 * referenced media is missing, so callers can skip orphaned rows.
 */
export function getDiaryEntryMedia(entry: DiaryEntry): MediaItem | undefined {
  return getMediaById(entry.mediaId);
}

/**
 * Diary entries of a single media kind for a user, newest first. Resolves the
 * media by id so the diary never has to store a `kind` on the entry itself.
 */
export function getDiaryEntriesByType(
  kind: MediaKind,
  userId: string = diaryOwnerId,
): DiaryEntry[] {
  return getDiaryEntriesForUser(userId).filter(
    (entry) => getDiaryEntryMedia(entry)?.kind === kind,
  );
}

/** Lightweight, derived rollup of a user's diary for the summary strip. */
export interface DiarySummary {
  /** The most recent year present in the diary. */
  year: number;
  /** Total entries logged in `year`. */
  total: number;
  movies: number;
  tv: number;
  books: number;
}

/**
 * Derive a small activity summary for the most recent year present in the
 * diary. Everything is computed from `diaryEntries` — no separately
 * maintained counters — so the numbers can never drift from the log.
 */
export function getDiarySummary(userId: string = diaryOwnerId): DiarySummary {
  const entries = getDiaryEntriesForUser(userId);
  const year = entries.reduce(
    (latest, entry) => Math.max(latest, new Date(entry.loggedAt).getFullYear()),
    0,
  );

  const summary: DiarySummary = { year, total: 0, movies: 0, tv: 0, books: 0 };
  for (const entry of entries) {
    if (new Date(entry.loggedAt).getFullYear() !== year) continue;
    summary.total += 1;
    const kind = getDiaryEntryMedia(entry)?.kind;
    if (kind === "movie") summary.movies += 1;
    else if (kind === "tv") summary.tv += 1;
    else if (kind === "book") summary.books += 1;
  }
  return summary;
}
