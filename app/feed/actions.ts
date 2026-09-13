"use server";

import { getCurrentUser } from "@/lib/auth/data";
import { getFollowingFeedPage } from "@/lib/supabase/feed";
import {
  GENERIC_LOAD_MORE_ERROR,
  SIGNED_OUT_LOAD_MORE_ERROR,
  UNAVAILABLE_LOAD_MORE_ERROR,
  type LoadMoreFeedResult,
} from "./feed-page-state";

/**
 * The `"use server"` boundary for feed pagination.
 *
 * Treated as a public endpoint. The cursor is a POSITION and grants nothing:
 *
 *   - the authenticated user is re-validated here through the server-only auth
 *     DAL before any read, and the RPC independently re-derives `auth.uid()`,
 *     re-joins `public.follows`, and runs under source RLS — so an unfollow or
 *     a sign-out between pages takes effect on the very next page;
 *   - the cursor is validated by the reader (an unrecognised cursor is a
 *     rejected request, never a silent "start again from the top"); and
 *   - only a stable, serializable page crosses back, never a raw Supabase
 *     error.
 */
export async function loadMoreFeedAction(
  cursor: string,
): Promise<LoadMoreFeedResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "signed-out", message: SIGNED_OUT_LOAD_MORE_ERROR };
  }

  const page = await getFollowingFeedPage({ cursor });

  switch (page.status) {
    case "ok":
      return {
        status: "ok",
        items: page.items,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      };
    case "signed-out":
      return { status: "signed-out", message: SIGNED_OUT_LOAD_MORE_ERROR };
    case "unavailable":
      return { status: "unavailable", message: UNAVAILABLE_LOAD_MORE_ERROR };
    case "error":
      return { status: "error", message: GENERIC_LOAD_MORE_ERROR };
  }
}
