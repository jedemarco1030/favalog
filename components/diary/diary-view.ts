import type { DiaryAction, MediaKind } from "@/lib/types";

/**
 * Filter values understood by the diary. `all` is a UI-only sentinel that
 * disables kind filtering; the rest mirror the `MediaKind` discriminant.
 */
export type DiaryFilter = "all" | MediaKind;

export interface DiaryFilterOption {
  value: DiaryFilter;
  label: string;
  /** Concise, consumer-facing copy for the "nothing here" empty state. */
  emptyLabel: string;
}

export const DIARY_FILTER_OPTIONS: readonly DiaryFilterOption[] = [
  { value: "all", label: "All", emptyLabel: "Nothing logged yet." },
  { value: "movie", label: "Movies", emptyLabel: "No movies logged yet." },
  { value: "tv", label: "TV", emptyLabel: "No TV logged yet." },
  { value: "book", label: "Books", emptyLabel: "No books logged yet." },
] as const;

/**
 * A fully-resolved, serializable diary row.
 *
 * The Server Component resolves every `mediaId`/`reviewId` reference into this
 * flat shape before handing it to the client, so the interactive layer never
 * imports the raw catalog or review arrays — it only filters what it is given.
 */
export interface DiaryEntryView {
  id: string;
  /** ISO timestamp; the client re-derives display strings via `Intl`. */
  loggedAt: string;
  kind: MediaKind;
  action: DiaryAction;
  rating?: number;
  slug: string;
  title: string;
  year: number;
  posterUrl: string;
  /** Present only when the entry references a review. */
  review?: {
    title?: string;
    excerpt: string;
  };
  /**
   * Full, raw values needed to pre-fill an edit dialog. Present ONLY for the
   * authenticated owner's real diary (never for the signed-out example diary),
   * so owner-only edit controls can open with the exact stored values.
   */
  edit?: {
    isRevisit: boolean;
    reviewTitle: string | null;
    reviewBody: string | null;
    containsSpoilers: boolean;
  };
}

const ACTION_LABEL: Record<DiaryAction, string> = {
  watched: "Watched",
  rewatched: "Rewatched",
  read: "Read",
  reread: "Reread",
};

/** Human-readable verb for a diary entry's action. */
export function diaryActionLabel(action: DiaryAction): string {
  return ACTION_LABEL[action];
}

/**
 * Trim a review body to a short, one-line excerpt on a word boundary. Shared
 * by both the mock diary and the real Supabase-backed diary so the excerpt
 * rendering is identical regardless of data source.
 */
export function excerptOf(body: string, max = 120): string {
  if (body.length <= max) return body;
  const clipped = body.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : max)}\u2026`;
}

/** The by-kind + total rollup rendered by the diary summary strip. */
export interface DiaryViewSummary {
  /** The most recent year present in the diary (0 when empty). */
  year: number;
  /** Total entries logged in `year`. */
  total: number;
  movies: number;
  tv: number;
  books: number;
}

/**
 * Derive the activity summary for the most recent year present in a set of
 * resolved diary views. Pure and source-agnostic: the numbers are computed
 * from the entries themselves so they can never drift from the timeline,
 * whether the entries come from mock data or a real Supabase query.
 */
export function summarizeDiaryViews(
  views: readonly DiaryEntryView[],
): DiaryViewSummary {
  const year = views.reduce(
    (latest, view) => Math.max(latest, new Date(view.loggedAt).getFullYear()),
    0,
  );

  const summary: DiaryViewSummary = {
    year,
    total: 0,
    movies: 0,
    tv: 0,
    books: 0,
  };
  for (const view of views) {
    if (new Date(view.loggedAt).getFullYear() !== year) continue;
    summary.total += 1;
    if (view.kind === "movie") summary.movies += 1;
    else if (view.kind === "tv") summary.tv += 1;
    else summary.books += 1;
  }
  return summary;
}
