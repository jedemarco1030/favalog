import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import {
  isUuid,
  validateEditInput,
  validateLogInput,
  type EditDiaryInput,
  type LogMediaInput,
  type LogFieldErrors,
} from "./log-input";
import {
  GENERIC_DELETE_ERROR,
  GENERIC_EDIT_ERROR,
  GENERIC_LOG_ERROR,
  mapDeleteError,
  mapEditError,
  mapLogError,
} from "./log-errors";

export { mapLogError, mapEditError, mapDeleteError } from "./log-errors";

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

/**
 * Revalidate every surface that reflects a diary write: the diary, the title
 * page (by trusted slug), and the author's own real public profile. The
 * username is resolved from the server-side auth DAL — never from a
 * client-supplied value — so a caller can't trigger revalidation of another
 * user's route. `slug` originates server-side (the title route param for a
 * create, or the RPC's own resolved slug for an edit/delete).
 */
async function revalidateDiaryWrite(slug: string | null): Promise<void> {
  revalidatePath("/diary");
  if (slug) {
    revalidatePath(`/title/${slug}`);
  }
  const profile = await getCurrentProfile();
  if (profile) {
    revalidatePath(`/profile/${profile.username}`);
  }
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

  // Refresh every surface that now reflects the new entry.
  await revalidateDiaryWrite(value.mediaSlug);

  return { status: "success", diaryEntryId, reviewId };
}

export type UpdateDiaryResult =
  | { status: "success"; diaryEntryId: string; reviewId: string | null }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "invalid"; errors: LogFieldErrors }
  | { status: "error"; message: string };

interface UpdateDiaryRpcResult {
  diary_entry_id?: string;
  review_id?: string | null;
  media_slug?: string | null;
}

/**
 * Edit an existing diary entry (and its optional linked review) for the current
 * user. Mirrors {@link logMedia}: refuses to run unconfigured, re-validates the
 * authenticated user and the input, and delegates the atomic write to the
 * `update_diary_entry` RPC — which derives ownership from `auth.uid()`, requires
 * the entry to belong to the caller, and runs under RLS. The client only
 * supplies the diary-entry id and the new field values; it never asserts
 * ownership. The title slug used for revalidation comes back from the RPC (the
 * trusted server-resolved catalog identity), not from the browser.
 */
export async function updateDiaryEntry(
  input: EditDiaryInput,
): Promise<UpdateDiaryResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const validation = validateEditInput(input);
  if (!validation.ok || !validation.value) {
    return { status: "invalid", errors: validation.errors };
  }
  const value = validation.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_diary_entry", {
    p_diary_entry_id: value.diaryEntryId,
    p_logged_at: value.loggedAt ?? undefined,
    p_rating: value.rating ?? undefined,
    p_is_revisit: value.isRevisit,
    p_review_title: value.reviewTitle ?? undefined,
    p_review_body: value.reviewBody ?? undefined,
    p_contains_spoilers: value.containsSpoilers,
  });

  if (error) {
    return { status: "error", message: mapEditError(error) };
  }

  const result = (data ?? {}) as UpdateDiaryRpcResult;
  const diaryEntryId =
    typeof result.diary_entry_id === "string"
      ? result.diary_entry_id.trim()
      : "";

  // Same defensive success contract as logMedia: a missing/malformed id means
  // an unexpected response shape, which we treat as an error rather than a
  // false success.
  if (diaryEntryId === "") {
    return { status: "error", message: GENERIC_EDIT_ERROR };
  }

  const reviewId =
    typeof result.review_id === "string" && result.review_id.trim() !== ""
      ? result.review_id.trim()
      : null;
  const slug =
    typeof result.media_slug === "string" && result.media_slug.trim() !== ""
      ? result.media_slug.trim()
      : null;

  await revalidateDiaryWrite(slug);

  return { status: "success", diaryEntryId, reviewId };
}

export type DeleteDiaryResult =
  | { status: "success"; diaryEntryId: string }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

interface DeleteDiaryRpcResult {
  diary_entry_id?: string;
  media_slug?: string | null;
}

/**
 * Delete an existing diary entry (and its linked review) for the current user.
 * Mirrors {@link updateDiaryEntry}: unconfigured → unavailable; signed-out →
 * unauthenticated; a non-UUID id is rejected client-side before any round-trip;
 * the atomic delete is delegated to the `delete_diary_entry` RPC, which requires
 * ownership via `auth.uid()` and removes the linked review so no orphan remains.
 */
export async function deleteDiaryEntry(
  diaryEntryId: string,
): Promise<DeleteDiaryResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const id = typeof diaryEntryId === "string" ? diaryEntryId.trim() : "";
  if (!isUuid(id)) {
    return {
      status: "invalid",
      message: "We couldn't tell which entry to delete. Please try again.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_diary_entry", {
    p_diary_entry_id: id,
  });

  if (error) {
    return { status: "error", message: mapDeleteError(error) };
  }

  const result = (data ?? {}) as DeleteDiaryRpcResult;
  const deletedId =
    typeof result.diary_entry_id === "string"
      ? result.diary_entry_id.trim()
      : "";

  if (deletedId === "") {
    return { status: "error", message: GENERIC_DELETE_ERROR };
  }

  const slug =
    typeof result.media_slug === "string" && result.media_slug.trim() !== ""
      ? result.media_slug.trim()
      : null;

  await revalidateDiaryWrite(slug);

  return { status: "success", diaryEntryId: deletedId };
}
