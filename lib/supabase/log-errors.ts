/**
 * Pure, safe mapping of Supabase/Postgres RPC errors to user-facing messages
 * for the diary write paths (log / edit / delete).
 *
 * Kept free of any server/Supabase import so it can be unit-tested in isolation
 * and reused by the server-only data layer. Raw error detail is NEVER surfaced
 * to the browser — every branch returns a stable, human-readable string.
 */

export const GENERIC_LOG_ERROR =
  "We couldn't save your log just now. Please try again in a moment.";
export const GENERIC_EDIT_ERROR =
  "We couldn't save your changes just now. Please try again in a moment.";
export const GENERIC_DELETE_ERROR =
  "We couldn't delete that entry just now. Please try again in a moment.";
const NOT_FOUND_TITLE_ERROR =
  "We couldn't find that title. Please refresh and try again.";
const NOT_FOUND_ENTRY_ERROR =
  "We couldn't find that diary entry. It may have already been removed.";

export interface DbError {
  code?: string;
  message?: string;
}

/**
 * Map an RPC error to a safe message. `notFound` and `generic` let each write
 * path phrase the "missing target" and fallback cases appropriately.
 */
export function mapWriteError(
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
    haystack.includes("unknown media") ||
    haystack.includes("unknown diary entry")
  ) {
    return notFound;
  }
  if (code === "22023" || haystack.includes("invalid rating")) {
    return "That rating isn't valid. Choose a half-star value from 0.5 to 5.";
  }
  if (code === "42501") {
    // RLS / privilege denial — never expose the raw detail.
    return "You don't have permission to do that.";
  }
  return generic;
}

/** Map a `log_media` RPC error to a safe, user-facing message. */
export function mapLogError(error: DbError): string {
  return mapWriteError(error, {
    notFound: NOT_FOUND_TITLE_ERROR,
    generic: GENERIC_LOG_ERROR,
  });
}

/** Map an `update_diary_entry` RPC error to a safe, user-facing message. */
export function mapEditError(error: DbError): string {
  return mapWriteError(error, {
    notFound: NOT_FOUND_ENTRY_ERROR,
    generic: GENERIC_EDIT_ERROR,
  });
}

/** Map a `delete_diary_entry` RPC error to a safe, user-facing message. */
export function mapDeleteError(error: DbError): string {
  return mapWriteError(error, {
    notFound: NOT_FOUND_ENTRY_ERROR,
    generic: GENERIC_DELETE_ERROR,
  });
}
