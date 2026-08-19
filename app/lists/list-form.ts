/**
 * Shared, pure state + parsing contracts for the list CREATE, ADD-ITEM,
 * REMOVE-ITEM, EDIT, and DELETE Server Actions, used with React's
 * `useActionState`.
 *
 * Kept out of the `"use server"` actions module (which may only export async
 * functions) so both the client dialogs and the actions can import these types,
 * and so the parsers can be unit-tested without any server imports.
 *
 * The parsers read ONLY allow-listed fields. They never read a user id,
 * username, ownership field, media UUID, or position: ownership is re-derived
 * server-side from `auth.uid()`, the media is resolved server-side from a
 * trusted slug, and positions are assigned by the database. The browser only
 * says WHICH list (by id) and WHICH title (by trusted slug) to act on.
 */

import type {
  CreateListInput,
  ListFieldErrors,
  UpdateListInput,
} from "@/lib/supabase/list-input";
import type { ListCreateVisibility } from "@/lib/types";

/** A submitted checkbox arrives as its `value` (default "on") when checked. */
function checkboxOn(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Build a {@link CreateListInput} from submitted form data. Pure and defensive:
 * reads only the allowed fields, leaving authoritative validation/normalization
 * to the server. `mediaSlug` is an optional trusted catalog slug used by the
 * "create list from the title dialog" flow.
 */
export function parseCreateListFormData(formData: FormData): CreateListInput {
  return {
    title: stringOrNull(formData.get("title")) ?? "",
    description: stringOrNull(formData.get("description")),
    isRanked: checkboxOn(formData.get("isRanked")),
    visibility: stringOrNull(formData.get("visibility")),
    mediaSlug: stringOrNull(formData.get("mediaSlug")),
  };
}

/** Read the list id + trusted media slug from an add/remove submission. */
export function parseListItemFormData(formData: FormData): {
  listId: string;
  mediaSlug: string;
} {
  return {
    listId: stringOrNull(formData.get("listId")) ?? "",
    mediaSlug: stringOrNull(formData.get("mediaSlug")) ?? "",
  };
}

/**
 * Build an {@link UpdateListInput} from submitted edit-list form data. Pure and
 * defensive: reads only the allowed fields (the list id lookup key plus the
 * editable metadata), never an owner id, username, slug, or timestamp. The slug
 * is immutable server-side, so it is deliberately not read here.
 */
export function parseUpdateListFormData(formData: FormData): UpdateListInput {
  return {
    listId: stringOrNull(formData.get("listId")) ?? "",
    title: stringOrNull(formData.get("title")) ?? "",
    description: stringOrNull(formData.get("description")),
    isRanked: checkboxOn(formData.get("isRanked")),
    visibility: stringOrNull(formData.get("visibility")),
  };
}

/** Read just the list id from a delete-list submission. */
export function parseDeleteListFormData(formData: FormData): {
  listId: string;
} {
  return { listId: stringOrNull(formData.get("listId")) ?? "" };
}

// ---------------------------------------------------------------------------
// Create-list form state
// ---------------------------------------------------------------------------

export type CreateListFormStatus =
  | "idle"
  | "success"
  | "invalid"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface CreateListFormState {
  status: CreateListFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Field-keyed validation errors for the `invalid` case. */
  fieldErrors?: ListFieldErrors;
  /**
   * Safe, same-origin path to navigate to for the auth / onboarding cases.
   * Always constructed on the server from validated values.
   */
  redirectTo?: string;
  /** Server-returned canonical identifiers on success. */
  listId?: string;
  slug?: string;
  /** The slug that was added atomically on creation, when applicable. */
  addedMediaSlug?: string | null;
  /**
   * The created list's own submitted summary, echoed on success so the
   * add-to-list dialog can fold the new list into its membership view.
   */
  title?: string;
  visibility?: ListCreateVisibility;
  isRanked?: boolean;
}

export const initialCreateListFormState: CreateListFormState = {
  status: "idle",
};

// ---------------------------------------------------------------------------
// Add / remove item form state
// ---------------------------------------------------------------------------

export type ListItemFormStatus =
  | "idle"
  | "success"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface ListItemFormState {
  status: ListItemFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Safe, same-origin path for the auth / onboarding cases. */
  redirectTo?: string;
  /** Which mutation succeeded, so the UI can update membership state. */
  action?: "added" | "removed";
  /** The list acted on (server-returned canonical slug + id). */
  slug?: string;
  listId?: string;
  /** True when an add was a no-op because the title was already present. */
  alreadyPresent?: boolean;
  /** True when a remove actually deleted a membership (false = already absent). */
  removed?: boolean;
}

export const initialListItemFormState: ListItemFormState = { status: "idle" };

// ---------------------------------------------------------------------------
// Edit-list form state
// ---------------------------------------------------------------------------

export type EditListFormStatus =
  | "idle"
  | "success"
  | "invalid"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface EditListFormState {
  status: EditListFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Field-keyed validation errors for the `invalid` case. */
  fieldErrors?: ListFieldErrors;
  /** Safe, same-origin path for the auth / onboarding cases. */
  redirectTo?: string;
  /** The edited list's canonical (immutable) identifiers on success. */
  listId?: string;
  slug?: string;
}

export const initialEditListFormState: EditListFormState = { status: "idle" };

// ---------------------------------------------------------------------------
// Delete-list form state
// ---------------------------------------------------------------------------

export type DeleteListFormStatus =
  | "idle"
  | "success"
  | "error"
  | "unavailable"
  | "unauthenticated"
  | "onboarding";

export interface DeleteListFormState {
  status: DeleteListFormStatus;
  /** Form-level, human-readable message (never a raw database error). */
  message?: string;
  /** Safe, same-origin path for the auth / onboarding cases. */
  redirectTo?: string;
}

export const initialDeleteListFormState: DeleteListFormState = {
  status: "idle",
};
