import "server-only";

import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import { mapMediaRowToDomain, type MediaItemRow } from "./mappers";
import {
  deriveProfileStats,
  effectiveReviewRating,
  recentTitlesOfKinds,
  type ProfileDiaryEntry,
  type ProfileStatsView,
} from "./profile-view-model";
import type { MediaItem, MediaKind } from "@/lib/types";

/**
 * Server-only read layer for a REAL public profile's derived activity.
 *
 * A real Supabase profile must NEVER inherit mock diary/review/list/favorite
 * data. This module queries only that profile owner's own diary and review
 * rows (a public read under the documented RLS model) and turns them into
 * derived, serializable statistics + recent titles + reviews via the pure
 * helpers in `profile-view-model.ts`. Media rows are mapped through the
 * existing `mapMediaRowToDomain` boundary, and a diary-linked review's
 * effective rating is resolved from its diary entry (its own DB rating is null
 * by design). Both queries embed their related rows to avoid an N+1.
 */

/** A real review, with its EFFECTIVE (diary-resolved) rating for display. */
export interface RealProfileReviewView {
  id: string;
  title?: string;
  body: string;
  createdAt: string;
  containsSpoilers: boolean;
  /** Effective rating (from the linked diary entry when present). */
  rating?: number;
  media: Pick<MediaItem, "slug" | "title" | "kind">;
}

export interface RealProfileActivity {
  stats: ProfileStatsView;
  recentlyWatched: MediaItem[];
  recentlyRead: MediaItem[];
  reviews: RealProfileReviewView[];
}

export type RealProfileActivityResult =
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; activity: RealProfileActivity };

interface DiaryActivityRow {
  logged_at: string;
  rating: number | null;
  media_items: MediaItemRow;
}

interface ReviewActivityRow {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  contains_spoilers: boolean;
  rating: number | null;
  media_items: { slug: string; title: string; kind: MediaKind };
  diary_entries: { rating: number | null } | { rating: number | null }[] | null;
}

/**
 * Read a real profile's derived activity by its stable profile id. Returns a
 * controlled `unavailable` when Supabase is not configured and a safe `error`
 * when a query fails — never a raw database error or a mock fallback.
 */
export async function getRealProfileActivity(
  profileId: string,
): Promise<RealProfileActivityResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const supabase = await createClient();

  const { data: diaryData, error: diaryError } = await supabase
    .from("diary_entries")
    .select("logged_at, rating, media_items!inner (*)")
    .eq("user_id", profileId)
    .order("logged_at", { ascending: false });

  if (diaryError) return { status: "error" };

  const diaryRows = (diaryData ?? []) as unknown as DiaryActivityRow[];
  const entries: ProfileDiaryEntry[] = diaryRows.map((row) => {
    const media = mapMediaRowToDomain(row.media_items);
    return {
      mediaId: media.id,
      kind: media.kind,
      rating: row.rating,
      media,
    };
  });

  const { data: reviewData, error: reviewError } = await supabase
    .from("reviews")
    .select(
      "id, title, body, created_at, contains_spoilers, rating, media_items!inner (slug, title, kind), diary_entries (rating)",
    )
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (reviewError) return { status: "error" };

  const reviewRows = (reviewData ?? []) as unknown as ReviewActivityRow[];
  const reviews: RealProfileReviewView[] = reviewRows.map((row) => {
    const diary = Array.isArray(row.diary_entries)
      ? row.diary_entries[0]
      : row.diary_entries;
    return {
      id: row.id,
      title: row.title ?? undefined,
      body: row.body,
      createdAt: row.created_at,
      containsSpoilers: row.contains_spoilers,
      rating: effectiveReviewRating(row.rating, diary?.rating ?? null),
      media: {
        slug: row.media_items.slug,
        title: row.media_items.title,
        kind: row.media_items.kind,
      },
    };
  });

  return {
    status: "ok",
    activity: {
      stats: deriveProfileStats(entries, reviews.length),
      recentlyWatched: recentTitlesOfKinds(entries, ["movie", "tv"], 8),
      recentlyRead: recentTitlesOfKinds(entries, ["book"], 8),
      reviews,
    },
  };
}
