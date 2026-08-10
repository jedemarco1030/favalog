import "server-only";

import { getCurrentUser } from "@/lib/auth/data";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import { deriveDiaryAction } from "./log-input";
import { toRatingValue } from "./mappers";
import { excerptOf, type DiaryEntryView } from "@/components/diary/diary-view";
import type { DiaryAction, MediaKind } from "@/lib/types";

/**
 * Server-only diary reads for the authenticated user.
 *
 * These are the counterparts to the write path in `log.ts`: narrowly-scoped,
 * owner-scoped queries that resolve raw rows through the existing mapper/view
 * boundary into the SAME serializable {@link DiaryEntryView} the mock diary
 * uses, so the interactive `DiaryTimeline` renders real data unchanged. Every
 * query:
 *   - returns a controlled "unavailable" state when Supabase is not configured
 *     (so a no-env build never crashes);
 *   - re-validates the current user via the auth DAL (never a client id); and
 *   - fetches associated media and any linked review in ONE query to avoid an
 *     N+1, and never leaks a raw row to a UI component.
 */

/** The current user's most recent diary entry for a single title. */
export interface PersonalTitleView {
  diaryEntryId: string;
  /** ISO timestamp of the most recent log. */
  loggedAt: string;
  action: DiaryAction;
  rating?: number;
  isRevisit: boolean;
  /** True when the most recent log carries a linked review. */
  hasReview: boolean;
}

export type PersonalTitleResult =
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "none" }
  | { status: "logged"; entry: PersonalTitleView };

interface PersonalRow {
  id: string;
  logged_at: string;
  rating: number | null;
  is_revisit: boolean;
  media_items: { kind: MediaKind; slug: string };
  reviews: { id: string }[] | { id: string } | null;
}

/**
 * The current user's most recent diary entry for the title with `slug`.
 *
 * Returns a `signed-out` / `none` state for the empty cases (never a raw row),
 * and `unavailable` when Supabase is not configured. Scoped to the validated
 * `auth.uid()` and resolved by stable slug, with any linked review fetched in
 * the same round-trip.
 */
export async function getMyLatestLogForSlug(
  slug: string,
): Promise<PersonalTitleResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const user = await getCurrentUser();
  if (!user) return { status: "signed-out" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select(
      "id, logged_at, rating, is_revisit, media_items!inner (kind, slug), reviews (id)",
    )
    .eq("media_items.slug", slug)
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fail closed: a read error simply means we show no personal state rather
  // than surfacing a database error on an otherwise-public title page.
  if (error || !data) return { status: "none" };

  const row = data as unknown as PersonalRow;
  const reviews = Array.isArray(row.reviews)
    ? row.reviews
    : row.reviews
      ? [row.reviews]
      : [];

  return {
    status: "logged",
    entry: {
      diaryEntryId: row.id,
      loggedAt: row.logged_at,
      action: deriveDiaryAction(row.media_items.kind, row.is_revisit),
      rating: toRatingValue(row.rating),
      isRevisit: row.is_revisit,
      hasReview: reviews.length > 0,
    },
  };
}

export type MyDiaryResult =
  | { status: "unavailable" }
  | { status: "signed-out" }
  | { status: "error" }
  | { status: "ok"; entries: DiaryEntryView[] };

interface DiaryRow {
  id: string;
  logged_at: string;
  rating: number | null;
  is_revisit: boolean;
  media_items: {
    slug: string;
    title: string;
    year: number;
    poster_url: string | null;
    kind: MediaKind;
  };
  reviews:
    | { title: string | null; body: string }[]
    | { title: string | null; body: string }
    | null;
}

function rowToDiaryView(row: DiaryRow): DiaryEntryView {
  const media = row.media_items;
  const kind = media.kind;
  const reviews = Array.isArray(row.reviews)
    ? row.reviews
    : row.reviews
      ? [row.reviews]
      : [];
  const review = reviews[0];

  return {
    id: row.id,
    loggedAt: row.logged_at,
    kind,
    action: deriveDiaryAction(kind, row.is_revisit),
    rating: toRatingValue(row.rating),
    slug: media.slug,
    title: media.title,
    year: media.year,
    posterUrl: media.poster_url ?? "",
    review:
      review && review.body
        ? { title: review.title ?? undefined, excerpt: excerptOf(review.body) }
        : undefined,
  };
}

/**
 * The authenticated user's real diary, newest first, resolved into the
 * serializable {@link DiaryEntryView} shape. Media and any linked review are
 * fetched alongside each entry (no N+1). A diary-linked review stores its
 * rating as null by design; the diary entry owns the rating, so the view's
 * `rating` comes from the entry — never treated as "unrated".
 */
export async function getMyDiary(): Promise<MyDiaryResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const user = await getCurrentUser();
  if (!user) return { status: "signed-out" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select(
      "id, logged_at, rating, is_revisit, media_items!inner (slug, title, year, poster_url, kind), reviews (title, body)",
    )
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false });

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as DiaryRow[];
  return { status: "ok", entries: rows.map(rowToDiaryView) };
}
