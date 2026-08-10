import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
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
  const diaryEntryId =
    typeof result.diary_entry_id === "string"
      ? result.diary_entry_id.trim()
      : "";

  // Defensive success contract: the RPC MUST return a real diary-entry id. A
  // missing / malformed identifier means the response shape was unexpected —
  // we never report success for an incomplete write, so the UI can't show a
  // "logged" confirmation for an entry that may not exist. Surface a safe
  // generic error instead (the raw RPC output is never exposed).
  if (diaryEntryId === "") {
    return { status: "error", message: GENERIC_LOG_ERROR };
  }

  const reviewId =
    typeof result.review_id === "string" && result.review_id.trim() !== ""
      ? result.review_id.trim()
      : null;

  // Refresh every surface that now reflects the new entry: the diary, the
  // title page, and the author's own real public profile. The username is
  // resolved from the server-side auth DAL — never from a client-supplied
  // value — so a caller can't trigger revalidation of another user's route.
  revalidatePath("/diary");
  revalidatePath(`/title/${value.mediaSlug}`);
  const profile = await getCurrentProfile();
  if (profile) {
    revalidatePath(`/profile/${profile.username}`);
  }

  return { status: "success", diaryEntryId, reviewId };
}
