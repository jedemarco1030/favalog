"use server";

import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  addListItem,
  createList,
  deleteList,
  removeListItem,
  updateList,
} from "@/lib/supabase/lists";
import {
  parseCreateListFormData,
  parseDeleteListFormData,
  parseListItemFormData,
  parseUpdateListFormData,
  type CreateListFormState,
  type DeleteListFormState,
  type EditListFormState,
  type ListItemFormState,
} from "./list-form";

/**
 * `"use server"` boundaries for the persistent list lifecycle: create a list,
 * add a title, remove a title, edit the list's metadata, and delete the whole
 * list. These are the only Client-callable entry points and are shared by the
 * lists index, the add-to-list dialog on `/title/[slug]`, and the real
 * `/list/[slug]` owner controls.
 *
 * Each is a thin, authoritative gate in front of the corresponding server write
 * path in `lib/supabase/lists.ts` — it does not duplicate the RPC call. Treated
 * as public endpoints, they:
 *
 *   - read only allow-listed fields (never a user id, media UUID, username,
 *     position, or ownership field);
 *   - rely on the write path to re-validate the authenticated user AND a
 *     complete onboarded profile via the server-only auth DAL, and on RLS +
 *     `auth.uid()` ownership in the database;
 *   - route a signed-out / expired-session caller through the existing safe
 *     `returnTo` flow, and an incomplete profile to onboarding — all redirect
 *     targets are server-built and validated (a client destination is never
 *     trusted); and
 *   - return a stable, serializable state for `useActionState`, never a raw
 *     Supabase/Postgres error.
 */

/** Append a validated `returnTo` query to a base path (omitted for "/"). */
function withReturnTo(base: string, returnTo: string): string {
  if (!returnTo || returnTo === "/") return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Resolve a safe navigation target for the auth / onboarding cases. */
function safeReturnTo(formData: FormData): string {
  return getSafeRedirectPath(formData.get("returnTo"), "/lists");
}

export async function createListAction(
  _prevState: CreateListFormState,
  formData: FormData,
): Promise<CreateListFormState> {
  const input = parseCreateListFormData(formData);
  const returnTo = safeReturnTo(formData);

  const result = await createList(input);
  switch (result.status) {
    case "success":
      return {
        status: "success",
        listId: result.listId,
        slug: result.slug,
        addedMediaSlug: result.addedMediaSlug,
        title: result.title,
        visibility: result.visibility,
        isRanked: result.isRanked,
      };
    case "invalid":
      return {
        status: "invalid",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: result.errors,
      };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to create a list.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile first.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Creating lists isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}

export async function addListItemAction(
  _prevState: ListItemFormState,
  formData: FormData,
): Promise<ListItemFormState> {
  const input = parseListItemFormData(formData);
  const returnTo = safeReturnTo(formData);

  const result = await addListItem(input);
  switch (result.status) {
    case "success":
      return {
        status: "success",
        action: "added",
        slug: result.slug,
        listId: result.listId,
        alreadyPresent: result.alreadyPresent,
      };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to update your list.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile first.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Updating lists isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}

export async function editListAction(
  _prevState: EditListFormState,
  formData: FormData,
): Promise<EditListFormState> {
  const input = parseUpdateListFormData(formData);
  const returnTo = safeReturnTo(formData);

  const result = await updateList(input);
  switch (result.status) {
    case "success":
      return { status: "success", listId: result.listId, slug: result.slug };
    case "invalid":
      return {
        status: "invalid",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: result.errors,
      };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to edit your list.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile first.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Editing lists isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}

export async function deleteListAction(
  _prevState: DeleteListFormState,
  formData: FormData,
): Promise<DeleteListFormState> {
  const input = parseDeleteListFormData(formData);
  const returnTo = safeReturnTo(formData);

  const result = await deleteList(input);
  switch (result.status) {
    case "success":
      return { status: "success" };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to delete your list.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile first.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Deleting lists isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}

export async function removeListItemAction(
  _prevState: ListItemFormState,
  formData: FormData,
): Promise<ListItemFormState> {
  const input = parseListItemFormData(formData);
  const returnTo = safeReturnTo(formData);

  const result = await removeListItem(input);
  switch (result.status) {
    case "success":
      return {
        status: "success",
        action: "removed",
        slug: result.slug,
        listId: result.listId,
        removed: result.removed,
      };
    case "invalid":
      return { status: "error", message: result.message };
    case "unauthenticated":
      return {
        status: "unauthenticated",
        message: "Please sign in to update your list.",
        redirectTo: withReturnTo("/auth/sign-in", returnTo),
      };
    case "incomplete-profile":
      return {
        status: "onboarding",
        message: "Finish setting up your profile first.",
        redirectTo: withReturnTo("/onboarding", returnTo),
      };
    case "unavailable":
      return {
        status: "unavailable",
        message: "Updating lists isn't available in this environment yet.",
      };
    case "error":
      return { status: "error", message: result.message };
  }
}
