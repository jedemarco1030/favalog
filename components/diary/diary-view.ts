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
