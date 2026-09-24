import "server-only";

import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import { effectiveReviewRating } from "./profile-view-model";
import { getReviewLikeStates, EMPTY_LIKE_STATE } from "./likes";
import type { MediaKind } from "@/lib/types";

/**
 * Server-only read layer for REAL (Supabase-backed) reviews of a title.
 *
 * Reviews are publicly readable under the documented RLS model, so this surface
 * shows every author's review of a given title — the community reviews on the
 * title page. Each review carries its author identity, its EFFECTIVE
 * (diary-resolved) rating, and its real like state (count + the viewer's own
 * bit) folded in from a single batched aggregation. No mock data and no
 * fabricated like counts ever appear here; a configured production surface
 * reads only the database.
 */

/** A real review of a title, ready to render with a like control. */
export interface RealMediaReviewView {
  id: string;
  title?: string;
  body: string;
  createdAt: string;
  containsSpoilers: boolean;
  /** Effective rating (from the linked diary entry when present). */
  rating?: number;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  /** Real like count for this review. */
  likeCount: number;
  /** Whether the current viewer has liked this review. */
  viewerHasLiked: boolean;
}

export type RealMediaReviewsResult =
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; reviews: RealMediaReviewView[] };

interface MediaReviewRow {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  contains_spoilers: boolean;
  rating: number | null;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  diary_entries: { rating: number | null } | { rating: number | null }[] | null;
}

/**
 * Read the real reviews of a title by its stable catalog slug, newest first,
 * with like state folded in. Returns a controlled `unavailable` when Supabase
 * is not configured and a safe `error` when a query fails — never a raw
 * database error or a mock fallback. An unknown slug yields an empty list
 * (a real title with no reviews), not an error.
 */
export async function getRealReviewsForMedia(
  mediaSlug: string,
): Promise<RealMediaReviewsResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  const slug = typeof mediaSlug === "string" ? mediaSlug.trim() : "";
  if (slug === "") return { status: "ok", reviews: [] };

  const supabase = await createClient();

  const { data: mediaRow, error: mediaError } = await supabase
    .from("media_items")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (mediaError) return { status: "error" };
  const mediaId = mediaRow?.id ?? null;
  if (!mediaId) return { status: "ok", reviews: [] };

  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, title, body, created_at, contains_spoilers, rating, profiles!reviews_user_id_fkey!inner (username, display_name, avatar_url), diary_entries (rating)",
    )
    .eq("media_id", mediaId)
    .order("created_at", { ascending: false });

  if (error) return { status: "error" };

  const rows = (data ?? []) as unknown as MediaReviewRow[];

  // Fold in like state with a SINGLE batched aggregation for all review ids —
  // never a per-row query (no N+1). Missing ids default to a zero/false state.
  const likeStates = await getReviewLikeStates(rows.map((r) => r.id));

  const reviews: RealMediaReviewView[] = rows.flatMap((row) => {
    // A review must have an author identity to be shown truthfully; drop rows
    // whose profile join is missing rather than invent an author.
    if (!row.profiles) return [];
    const diary = Array.isArray(row.diary_entries)
      ? row.diary_entries[0]
      : row.diary_entries;
    const like = likeStates.get(row.id) ?? EMPTY_LIKE_STATE;
    return [
      {
        id: row.id,
        title: row.title ?? undefined,
        body: row.body,
        createdAt: row.created_at,
        containsSpoilers: row.contains_spoilers,
        rating: effectiveReviewRating(row.rating, diary?.rating ?? null),
        author: {
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url ?? null,
        },
        likeCount: like.likeCount,
        viewerHasLiked: like.viewerHasLiked,
      },
    ];
  });

  return { status: "ok", reviews };
}

export type { MediaKind };
