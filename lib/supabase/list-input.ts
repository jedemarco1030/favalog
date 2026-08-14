/**
 * Pure input logic for the persistent list interactions (create a list, add a
 * title, remove a title).
 *
 * Like `log-input.ts`, this module is intentionally free of any
 * server/Supabase/React imports so it can be reused by both the client form
 * (immediate feedback) and the server layer (authoritative validation), and
 * unit-tested in isolation. It mirrors the constraints the database enforces
 * (the lists CHECKs and the create_list / add_list_item / remove_list_item
 * RPCs) so the UI can reject bad input before a round-trip, while the RPCs
 * remain the final authority.
 */

import type { ListCreateVisibility } from "@/lib/types";
import { isUuid } from "./log-input";

export { isUuid } from "./log-input";

/** Maximum list title / description lengths, matching the lists CHECKs. */
export const MAX_LIST_TITLE = 150;
export const MAX_LIST_DESCRIPTION = 2000;

/**
 * The visibility values a user may choose when creating a list this phase.
 * `followers` is deliberately withheld (see {@link ListCreateVisibility}).
 */
export const LIST_CREATE_VISIBILITIES: readonly ListCreateVisibility[] = [
  "public",
  "private",
] as const;

/** Field-keyed validation errors (safe, human-readable, never raw DB text). */
export type ListFieldErrors = Partial<
  Record<"title" | "description" | "visibility" | "form", string>
>;

/** Raw, untrusted input as it arrives from the create-list form. */
export interface CreateListInput {
  title: string;
  description?: string | null;
  isRanked?: boolean;
  /** One of {@link LIST_CREATE_VISIBILITIES}; anything else is rejected. */
  visibility?: string | null;
  /** Optional trusted catalog slug to add atomically on creation. */
  mediaSlug?: string | null;
}

/** A normalized, server-ready create-list payload derived from valid input. */
export interface NormalizedCreateListInput {
  title: string;
  description: string | null;
  isRanked: boolean;
  visibility: ListCreateVisibility;
  mediaSlug: string | null;
}

export interface CreateListValidationResult {
  ok: boolean;
  errors: ListFieldErrors;
  /** Present only when `ok` is true. */
  value?: NormalizedCreateListInput;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Narrow an untrusted string to a creatable {@link ListCreateVisibility}, or
 * `null` when it is not one of the allowed values. `public` is never assumed as
 * a default here — callers decide how to treat a missing value.
 */
export function normalizeVisibility(
  value: string | null | undefined,
): ListCreateVisibility | null {
  return value === "public" || value === "private" ? value : null;
}

/**
 * Validate and normalize create-list input. Rules mirror the database:
 *  - a title is required and must be 1..150 characters after trimming;
 *  - a description, when present, must be <= 2000 characters;
 *  - visibility must be one of the creatable values (defaults to `public` only
 *    when omitted/blank, never when an unknown value is supplied);
 *  - a media slug, when present, is carried through as the trusted catalog slug
 *    (resolved server-side by the RPC).
 */
export function validateCreateListInput(
  input: CreateListInput,
): CreateListValidationResult {
  const errors: ListFieldErrors = {};

  const title = trimOrNull(input.title);
  if (!title) {
    errors.title = "Give your list a title.";
  } else if (title.length > MAX_LIST_TITLE) {
    errors.title = `Keep the title under ${MAX_LIST_TITLE} characters.`;
  }

  const description = trimOrNull(input.description);
  if (description && description.length > MAX_LIST_DESCRIPTION) {
    errors.description = `Keep the description under ${MAX_LIST_DESCRIPTION.toLocaleString()} characters.`;
  }

  // A missing/blank visibility defaults to public; an explicit unknown value is
  // an error (we never silently coerce an unrecognized choice).
  let visibility: ListCreateVisibility = "public";
  const rawVisibility = trimOrNull(input.visibility);
  if (rawVisibility !== null) {
    const normalized = normalizeVisibility(rawVisibility);
    if (normalized === null) {
      errors.visibility = "Choose either public or private.";
    } else {
      visibility = normalized;
    }
  }

  const mediaSlug = trimOrNull(input.mediaSlug);

  const ok = Object.keys(errors).length === 0;
  if (!ok || !title) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    value: {
      title,
      description,
      isRanked: Boolean(input.isRanked),
      visibility,
      mediaSlug,
    },
  };
}

/** Raw, untrusted input for adding/removing a title in a list. */
export interface ListItemInput {
  /** The target list; ownership is re-checked server-side. */
  listId: string;
  /** Trusted catalog slug (from the title route / dialog). */
  mediaSlug: string;
}

/** A normalized, server-ready list-item payload derived from valid input. */
export interface NormalizedListItemInput {
  listId: string;
  mediaSlug: string;
}

export interface ListItemValidationResult {
  ok: boolean;
  /** A single safe form-level message when invalid. */
  message?: string;
  /** Present only when `ok` is true. */
  value?: NormalizedListItemInput;
}

/**
 * Validate add/remove input: a syntactically valid list UUID and a non-empty
 * media slug. The list id is only a lookup key — ownership is re-derived from
 * `auth.uid()` in the database, never trusted from the client.
 */
export function validateListItemInput(
  input: ListItemInput,
): ListItemValidationResult {
  const listId = trimOrNull(input.listId);
  if (!listId || !isUuid(listId)) {
    return {
      ok: false,
      message: "We couldn't tell which list to update. Please try again.",
    };
  }

  const mediaSlug = trimOrNull(input.mediaSlug);
  if (!mediaSlug) {
    return {
      ok: false,
      message: "We couldn't tell which title to update. Please try again.",
    };
  }

  return { ok: true, value: { listId, mediaSlug } };
}
