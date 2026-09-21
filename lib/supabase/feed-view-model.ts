/**
 * Pure row -> view-model mapping for the following feed.
 *
 * The `public.get_following_feed` RPC already did the authorization, the
 * follows join, the linked-review deduplication, the total ordering and the
 * bounded seek. This module's only job is to turn one of its rows into the
 * serializable {@link FeedActivityView} the feed UI renders, reusing the
 * EXISTING derivations so the wording, ratings and excerpts stay identical to
 * the diary and profile surfaces:
 *
 *   - the verb comes from {@link deriveDiaryAction} (watched / rewatched /
 *     read / reread), or `"reviewed"` for a standalone review — a rating alone
 *     never implies completion;
 *   - a diary item's rating is the DIARY entry's rating (a diary-linked review
 *     stores no rating by design); and
 *   - the excerpt comes from the shared {@link excerptOf}.
 *
 * Defensive by design: the generated function types widen every returned
 * column to non-nullable even though most are nullable in SQL, so every field
 * is treated as possibly `null`/malformed here. A row that cannot be rendered
 * truthfully is DROPPED rather than displayed with invented values.
 *
 * Kept free of any server/Supabase import so it can be unit-tested in
 * isolation.
 */

import { excerptOf } from "@/components/diary/diary-view";
import { deriveDiaryAction } from "./log-input";
import { toRatingValue } from "./mappers";
import type { FeedSource } from "./feed-cursor";
import type { DiaryAction, MediaKind } from "@/lib/types";

/** The feed verb: a real diary action, or a standalone review. */
export type FeedAction = DiaryAction | "reviewed";

/** One combined activity item, ready to render. */
export interface FeedActivityView {
  /** `${source}:${activity_id}` — stable React key. */
  key: string;
  source: FeedSource;
  /** Immutable record creation time (the ordering key). */
  createdAt: string;
  /** The user-selected diary date, only when worth showing separately. */
  loggedAt?: string;
  actor: { username: string; displayName: string; avatarUrl?: string };
  media: {
    slug: string;
    title: string;
    year: number;
    kind: MediaKind;
    posterUrl: string;
  };
  action: FeedAction;
  /** Effective (diary-resolved) rating, when one was recorded. */
  rating?: number;
  review?: {
    id: string;
    title?: string;
    excerpt: string;
    containsSpoilers: boolean;
    /** Server-truth like aggregate, folded in after mapping by the reader. */
    likeCount: number;
    /** Whether the current viewer has liked this review (server truth). */
    viewerHasLiked: boolean;
  };
}

/**
 * One `get_following_feed` row, typed with the nullability the DATABASE
 * actually has (not the widened generated type).
 */
export interface FeedActivityRow {
  source: string | null;
  activity_id: string | null;
  created_at: string | null;
  logged_at: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  media_slug: string | null;
  media_title: string | null;
  media_year: number | null;
  media_kind: string | null;
  media_poster_url: string | null;
  rating: number | null;
  is_revisit: boolean | null;
  review_id: string | null;
  review_title: string | null;
  review_body: string | null;
  contains_spoilers: boolean | null;
}

const MEDIA_KINDS: readonly string[] = ["movie", "tv", "book"];

function asMediaKind(value: unknown): MediaKind | null {
  return typeof value === "string" && MEDIA_KINDS.includes(value)
    ? (value as MediaKind)
    : null;
}

function asFeedSource(value: unknown): FeedSource | null {
  if (value === "diary" || value === "review") return value;
  return null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The UTC calendar day of an instant, or `null` when it is unparseable. */
function utcDay(value: string): string | null {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Whether the user-selected diary date is worth showing next to the record
 * creation time.
 *
 * The rule is deliberately conservative: show it only when the two fall on
 * DIFFERENT UTC calendar days — i.e. the entry was genuinely backdated (or
 * post-dated). A log created moments after its diary date is the normal case
 * and showing both would be noise, not information.
 */
export function shouldShowLoggedAt(
  createdAt: string,
  loggedAt: string | null | undefined,
): boolean {
  if (!loggedAt) return false;
  const loggedDay = utcDay(loggedAt);
  const createdDay = utcDay(createdAt);
  if (loggedDay === null || createdDay === null) return false;
  return loggedDay !== createdDay;
}

/**
 * Map one row to a {@link FeedActivityView}, or `null` when the row is
 * incomplete/malformed and could not be rendered truthfully.
 */
export function mapFeedRow(row: FeedActivityRow): FeedActivityView | null {
  const source = asFeedSource(row.source);
  const activityId = asText(row.activity_id);
  const createdAt = asText(row.created_at);
  const username = asText(row.actor_username);
  const slug = asText(row.media_slug);
  const kind = asMediaKind(row.media_kind);

  if (!source || !activityId || !createdAt || !username || !slug || !kind) {
    return null;
  }

  const reviewId = asText(row.review_id);
  const reviewBody = typeof row.review_body === "string" ? row.review_body : "";
  const reviewTitle = asText(row.review_title);
  const hasReview = reviewId !== "" && reviewBody.trim() !== "";

  // A standalone review is its own item; a diary item keeps its real verb even
  // when a review is embedded, because the log is what actually happened.
  const action: FeedAction =
    source === "review"
      ? "reviewed"
      : deriveDiaryAction(kind, row.is_revisit === true);

  const displayName = asText(row.actor_display_name) || username;
  const avatarUrl = asText(row.actor_avatar_url);
  const loggedAt = asText(row.logged_at);

  return {
    key: `${source}:${activityId}`,
    source,
    createdAt,
    ...(source === "diary" && shouldShowLoggedAt(createdAt, loggedAt)
      ? { loggedAt }
      : {}),
    actor: {
      username,
      displayName,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
    media: {
      slug,
      title: asText(row.media_title) || slug,
      year: typeof row.media_year === "number" ? row.media_year : 0,
      kind,
      posterUrl: asText(row.media_poster_url),
    },
    action,
    rating: toRatingValue(row.rating),
    ...(hasReview
      ? {
          review: {
            id: reviewId,
            ...(reviewTitle ? { title: reviewTitle } : {}),
            excerpt: excerptOf(reviewBody),
            containsSpoilers: row.contains_spoilers === true,
            // The following feed RPC carries no like data; the reader folds in
            // server-truth like state after mapping. Default to a zero/false
            // state so an un-enriched view is still honest, never invented.
            likeCount: 0,
            viewerHasLiked: false,
          },
        }
      : {}),
  };
}

/** Map a page of rows, dropping any row that cannot be rendered truthfully. */
export function mapFeedRows(rows: FeedActivityRow[]): FeedActivityView[] {
  return rows.flatMap((row) => {
    const view = mapFeedRow(row);
    return view ? [view] : [];
  });
}
