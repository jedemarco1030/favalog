import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/data";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import {
  validateLogInput,
  type LogMediaInput,
  type LogFieldErrors,
} from "./log-input";

/**
 * Server-side write path for logging a title.
 *
 * This is the single entry point the UI calls to create a diary entry (and an
 * optional linked review). It is authoritative and independent of any client
 * check:
 *   - it refuses to run without Supabase configured (a controlled "unavailable"
 *     state, so no-env builds never crash);
 *   - it re-validates the authenticated user via the server-only auth DAL
 *     (never trusting client-supplied identity);
 *   - it re-validates and normalizes the input server-side; and
 *   - it delegates the atomic write to the `log_media` RPC, which derives
 *     ownership from auth.uid() and runs under RLS.
 *
 * Raw Supabase/Postgres errors are never returned to the browser — they are
 * mapped to safe, human-readable messages.
 */

export type LogMediaResult =
  | { status: "success"; diaryEntryId: string; reviewId: string | null }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "invalid"; errors: LogFieldErrors }
  | { status: "error"; message: string };

const GENERIC_LOG_ERROR =
  "We couldn't save your log just now. Please try again in a moment.";

/** Map a Supabase RPC error to a safe, user-facing message. */
export function mapLogError(error: {
  code?: string;
  message?: string;
}): string {
  const code = error.code ?? "";
  const haystack = `${code} ${error.message ?? ""}`.toLowerCase();

  if (code === "28000" || haystack.includes("authentication required")) {
    return "Please sign in to log a title.";
  }
  if (code === "P0002" || haystack.includes("unknown media")) {
    return "We couldn't find that title. Please refresh and try again.";
  }
  if (code === "22023" || haystack.includes("invalid rating")) {
    return "That rating isn't valid. Choose a half-star value from 0.5 to 5.";
  }
  if (code === "42501") {
    // RLS / privilege denial — never expose the raw detail.
    return "You don't have permission to do that.";
  }
  return GENERIC_LOG_ERROR;
}

interface LogMediaRpcResult {
  diary_entry_id?: string;
  review_id?: string | null;
}

/**
 * Create a diary entry (and optional linked review) for the current user.
 *
 * `input.mediaSlug` must be a trusted catalog slug (e.g. from the title route);
 * the RPC resolves it to a media UUID server-side, so no media metadata is ever
 * accepted from the browser.
 */
export async function logMedia(input: LogMediaInput): Promise<LogMediaResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const validation = validateLogInput(input);
  if (!validation.ok || !validation.value) {
    return { status: "invalid", errors: validation.errors };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_media", {
    p_media_slug: value.mediaSlug,
    p_logged_at: value.loggedAt ?? undefined,
    p_rating: value.rating ?? undefined,
    p_is_revisit: value.isRevisit,
    p_review_title: value.reviewTitle ?? undefined,
    p_review_body: value.reviewBody ?? undefined,
    p_contains_spoilers: value.containsSpoilers,
  });

  if (error) {
    return { status: "error", message: mapLogError(error) };
  }

  const result = (data ?? {}) as LogMediaRpcResult;

  // Refresh the surfaces that now reflect the new entry. The profile route is
  // keyed by username, which we don't need here; revalidating the diary and the
  // title page covers the pages the user navigates back to.
  revalidatePath("/diary");
  revalidatePath(`/title/${value.mediaSlug}`);

  return {
    status: "success",
    diaryEntryId: result.diary_entry_id ?? "",
    reviewId: result.review_id ?? null,
  };
}
