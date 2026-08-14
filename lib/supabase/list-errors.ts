/**
 * Pure, safe mapping of Supabase/Postgres RPC errors to user-facing messages
 * for the list write paths (create / add item / remove item).
 *
 * Kept free of any server/Supabase import so it can be unit-tested in isolation
 * and reused by the server-only data layer. Raw error detail is NEVER surfaced
 * to the browser — every branch returns a stable, human-readable string.
 */

import type { DbError } from "./log-errors";

export type { DbError } from "./log-errors";

export const GENERIC_CREATE_LIST_ERROR =
  "We couldn't create your list just now. Please try again in a moment.";
export const GENERIC_ADD_ITEM_ERROR =
  "We couldn't add that title to your list just now. Please try again in a moment.";
export const GENERIC_REMOVE_ITEM_ERROR =
  "We couldn't remove that title from your list just now. Please try again in a moment.";

const NOT_FOUND_LIST_ERROR =
  "We couldn't find that list. Please refresh and try again.";
const NOT_FOUND_TITLE_ERROR =
  "We couldn't find that title. Please refresh and try again.";

/**
 * Map a list RPC error to a safe message. `notFound` and `generic` let each
 * write path phrase the "missing target" and fallback cases appropriately,
 * while the shared auth / privilege / invalid-input branches stay consistent
 * with the diary write paths.
 */
function mapListWriteError(
  error: DbError,
  { notFound, generic }: { notFound: string; generic: string },
): string {
  const code = error.code ?? "";
  const haystack = `${code} ${error.message ?? ""}`.toLowerCase();

  if (code === "28000" || haystack.includes("authentication required")) {
    return "Please sign in to continue.";
  }
  if (
    code === "P0002" ||
    haystack.includes("unknown list") ||
    haystack.includes("unknown media")
  ) {
    return notFound;
  }
  if (
    code === "22023" ||
    haystack.includes("invalid list title") ||
    haystack.includes("invalid list description") ||
    haystack.includes("invalid list visibility")
  ) {
    return "Please check the list details and try again.";
  }
  if (code === "42501") {
    // RLS / privilege denial — never expose the raw detail.
    return "You don't have permission to do that.";
  }
  return generic;
}

/** Map a `create_list` RPC error to a safe, user-facing message. */
export function mapCreateListError(error: DbError): string {
  return mapListWriteError(error, {
    notFound: NOT_FOUND_TITLE_ERROR,
    generic: GENERIC_CREATE_LIST_ERROR,
  });
}

/** Map an `add_list_item` RPC error to a safe, user-facing message. */
export function mapAddItemError(error: DbError): string {
  return mapListWriteError(error, {
    notFound: NOT_FOUND_LIST_ERROR,
    generic: GENERIC_ADD_ITEM_ERROR,
  });
}

/** Map a `remove_list_item` RPC error to a safe, user-facing message. */
export function mapRemoveItemError(error: DbError): string {
  return mapListWriteError(error, {
    notFound: NOT_FOUND_LIST_ERROR,
    generic: GENERIC_REMOVE_ITEM_ERROR,
  });
}
