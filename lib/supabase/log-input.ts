/**
 * Pure input logic for the "log a title" interaction.
 *
 * This module is intentionally free of any server/Supabase/React imports so it
 * can be reused by both the client form (immediate feedback) and the server
 * action (authoritative validation), and unit-tested in isolation. It mirrors
 * the constraints the database enforces (the diary_entries / reviews CHECKs and
 * the log_media RPC) so the UI can reject bad input before a round-trip, while
 * the RPC remains the final authority.
 */

import type { DiaryAction, MediaKind } from "@/lib/types";

/** Lowest / highest valid diary rating (half-star scale). */
export const MIN_RATING = 0.5;
export const MAX_RATING = 5;
/** Maximum length of a review body / title, matching the reviews CHECKs. */
export const MAX_REVIEW_BODY = 10_000;
export const MAX_REVIEW_TITLE = 150;

/**
 * A rating is valid when it is a half-star value in [0.5, 5.0]. `null` /
 * `undefined` mean "no rating", which is always allowed. Whole `0` is NOT a
 * valid rating — absence is represented by null (matching the DB CHECK).
 */
export function isValidRating(rating: number | null | undefined): boolean {
  if (rating === null || rating === undefined) return true;
  return (
    Number.isFinite(rating) &&
    rating >= MIN_RATING &&
    rating <= MAX_RATING &&
    rating * 2 === Math.floor(rating * 2)
  );
}

/**
 * The media-appropriate verb for a log event. Films and series are
 * watched/rewatched; books are read/reread. Used both for the diary view model
 * and for the action button labels.
 */
export function deriveDiaryAction(
  kind: MediaKind,
  isRevisit: boolean,
): DiaryAction {
  if (kind === "book") return isRevisit ? "reread" : "read";
  return isRevisit ? "rewatched" : "watched";
}

/** The verb shown on the primary action for a title, before it is logged. */
export function logVerbLabel(kind: MediaKind, isRevisit: boolean): string {
  const action = deriveDiaryAction(kind, isRevisit);
  return action.charAt(0).toUpperCase() + action.slice(1);
}

/** Raw, untrusted input as it arrives from the log form. */
export interface LogMediaInput {
  /** Trusted catalog slug (from the title route), resolved server-side. */
  mediaSlug: string;
  /** ISO timestamp of the diary date. Defaults to now when omitted. */
  loggedAt?: string | null;
  /** Optional half-star rating. */
  rating?: number | null;
  /** Rewatch / reread flag. */
  isRevisit?: boolean;
  /** Optional review title (only meaningful with a body). */
  reviewTitle?: string | null;
  /** Optional review body — a non-empty body creates a linked review. */
  reviewBody?: string | null;
  /** Spoiler flag; only meaningful when a review body is present. */
  containsSpoilers?: boolean;
}

/** Field-keyed validation errors (safe, human-readable, never raw DB text). */
export type LogFieldErrors = Partial<
  Record<"loggedAt" | "rating" | "reviewTitle" | "reviewBody" | "form", string>
>;

/** A normalized, server-ready payload derived from valid input. */
export interface NormalizedLogInput {
  mediaSlug: string;
  loggedAt: string | null;
  rating: number | null;
  isRevisit: boolean;
  reviewTitle: string | null;
  reviewBody: string | null;
  containsSpoilers: boolean;
}

export interface LogValidationResult {
  ok: boolean;
  errors: LogFieldErrors;
  /** Present only when `ok` is true. */
  value?: NormalizedLogInput;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Convert a form-supplied local date/time into a UTC ISO timestamp, or `null`
 * when the value is empty / unparseable.
 *
 * Timezone-safety: a bare `YYYY-MM-DD` string is parsed by `new Date()` as UTC
 * midnight, which in a negative-offset timezone renders as the PREVIOUS day.
 * A `datetime-local` value (`YYYY-MM-DDTHH:mm`) is instead parsed as LOCAL
 * time, which is what we want. So we only append a local midnight time to a
 * bare date, then let `Date` interpret the datetime-local form in local time
 * before normalising to ISO. This keeps the diary date the user intended.
 */
export function datetimeLocalToISO(
  value: string | null | undefined,
): string | null {
  const raw = trimOrNull(value);
  if (!raw) return null;
  const local = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00` : raw;
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Validate and normalize log input.
 *
 * Rules mirror the database:
 *  - a media slug is required (the trusted catalog identity);
 *  - a rating, when present, must be a half-star value in [0.5, 5.0];
 *  - a logged date, when present, must parse and must not be in the future;
 *  - a review body, when present, must be within length limits; an empty body
 *    means "no review" and clears the title/spoiler flag so the linked review
 *    is not created;
 *  - a review title (with a body) must be within its length limit.
 */
export function validateLogInput(
  input: LogMediaInput,
  now: Date = new Date(),
): LogValidationResult {
  const errors: LogFieldErrors = {};

  const mediaSlug = trimOrNull(input.mediaSlug);
  if (!mediaSlug) {
    errors.form = "We couldn't tell which title to log. Please try again.";
  }

  // Rating.
  const rating =
    input.rating === undefined || input.rating === null ? null : input.rating;
  if (!isValidRating(rating)) {
    errors.rating = "Choose a rating from 0.5 to 5 stars in half-star steps.";
  }

  // Logged date. Route through the timezone-safe converter so a bare date is
  // never shifted to the previous day by UTC parsing.
  let loggedAt: string | null = null;
  const rawLoggedAt = trimOrNull(input.loggedAt);
  if (rawLoggedAt) {
    const iso = datetimeLocalToISO(rawLoggedAt);
    if (iso === null) {
      errors.loggedAt = "Enter a valid date and time.";
    } else if (new Date(iso).getTime() > now.getTime() + 60_000) {
      errors.loggedAt = "You can't log a title in the future.";
    } else {
      loggedAt = iso;
    }
  }

  // Review.
  const reviewBody = trimOrNull(input.reviewBody);
  const reviewTitle = trimOrNull(input.reviewTitle);
  if (reviewBody && reviewBody.length > MAX_REVIEW_BODY) {
    errors.reviewBody = `Keep your review under ${MAX_REVIEW_BODY.toLocaleString()} characters.`;
  }
  if (reviewBody && reviewTitle && reviewTitle.length > MAX_REVIEW_TITLE) {
    errors.reviewTitle = `Keep the review title under ${MAX_REVIEW_TITLE} characters.`;
  }

  const ok = Object.keys(errors).length === 0;
  if (!ok || !mediaSlug) {
    return { ok: false, errors };
  }

  // A review title / spoiler flag are only meaningful with a body.
  const hasReview = reviewBody !== null;
  return {
    ok: true,
    errors: {},
    value: {
      mediaSlug,
      loggedAt,
      rating,
      isRevisit: Boolean(input.isRevisit),
      reviewTitle: hasReview ? reviewTitle : null,
      reviewBody: hasReview ? reviewBody : null,
      containsSpoilers: hasReview ? Boolean(input.containsSpoilers) : false,
    },
  };
}
