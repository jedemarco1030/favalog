/**
 * Open Library adapter configuration (server-only).
 *
 * Open Library asks integrators to (a) identify themselves with a descriptive
 * `User-Agent` that includes a contact, and (b) keep volume low and cache
 * results — it is a small nonprofit service, not a bulk data source. We honour
 * both: the contact comes from the server-only `OPEN_LIBRARY_CONTACT_EMAIL` (no
 * personal info is hardcoded), and if it is missing a LIVE request fails closed
 * with a `not_configured` provider error rather than sending an anonymous
 * request. Nothing here throws at import time.
 */

/** Open Library API base. */
export const OPEN_LIBRARY_BASE = "https://openlibrary.org" as const;
/** Approved cover-image host. Covers are referenced by numeric id. */
export const OPEN_LIBRARY_COVERS_BASE =
  "https://covers.openlibrary.org/b/id" as const;
/** Cover size suffix (`S`/`M`/`L`). Large is the poster-equivalent. */
export const OPEN_LIBRARY_COVER_SIZE = "L" as const;

/** Application name advertised in the User-Agent. */
export const OPEN_LIBRARY_APP_NAME = "Favalog" as const;

/**
 * Read the server-only Open Library contact. Returns `undefined` (never throws)
 * when unset/blank so live callers fail closed with `not_configured`.
 */
export function getOpenLibraryContact(): string | undefined {
  const contact = process.env.OPEN_LIBRARY_CONTACT_EMAIL?.trim();
  return contact ? contact : undefined;
}

/** Whether Open Library is usable (an identifying contact is configured). */
export function isOpenLibraryConfigured(): boolean {
  return getOpenLibraryContact() !== undefined;
}

/**
 * Build the identifying User-Agent, e.g. `Favalog (someone@example.com)`. The
 * contact is required by the caller before this is used; passing a blank contact
 * would be a programming error, so it is asserted non-blank by the caller.
 */
export function buildUserAgent(contact: string): string {
  return `${OPEN_LIBRARY_APP_NAME} (${contact})`;
}

/**
 * Build a safe cover URL from a numeric Open Library cover id, or `undefined`
 * when the id is missing/invalid. Only a positive integer id is accepted, so no
 * arbitrary URL can be injected.
 */
export function openLibraryCoverUrl(
  coverId: number | null | undefined,
): string | undefined {
  if (
    typeof coverId !== "number" ||
    !Number.isInteger(coverId) ||
    coverId <= 0
  ) {
    return undefined;
  }
  return `${OPEN_LIBRARY_COVERS_BASE}/${coverId}-${OPEN_LIBRARY_COVER_SIZE}.jpg`;
}

/** Strip Open Library's `/works/` prefix from a work key to get the Work id. */
export function workKeyToId(
  key: string | null | undefined,
): string | undefined {
  if (typeof key !== "string") return undefined;
  const match = /^\/works\/(OL\d+W)$/.exec(key.trim());
  return match ? match[1] : undefined;
}

/** Build a work key path from a Work id. */
export function workIdToKey(id: string): string {
  return `/works/${id}`;
}
