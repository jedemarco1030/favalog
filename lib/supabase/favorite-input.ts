/**
 * Pure input logic for the persistent favorite interaction (mark a title as a
 * favorite / remove it).
 *
 * Like `list-input.ts` and `log-input.ts`, this module is intentionally free of
 * any server/Supabase/React imports so it can be reused by both the client
 * control (immediate feedback) and the server layer (authoritative validation),
 * and unit-tested in isolation. It mirrors the constraints the database
 * enforces (the favorites table + the set_favorite RPC): a favorite references
 * a trusted catalog title by its stable slug (resolved server-side), and the
 * only other input is the DESIRED boolean state. The browser never supplies a
 * user id, media UUID, username, position, or ownership field.
 */

/** Raw, untrusted input as it arrives from the favorite control. */
export interface SetFavoriteInput {
  /** Trusted catalog slug (from the title route), resolved server-side. */
  mediaSlug: string;
  /** The desired end-state: true to favorite, false to remove. */
  isFavorite: boolean;
}

/** A normalized, server-ready set-favorite payload derived from valid input. */
export interface NormalizedSetFavoriteInput {
  mediaSlug: string;
  isFavorite: boolean;
}

export interface SetFavoriteValidationResult {
  ok: boolean;
  /** A single safe form-level message when invalid. */
  message?: string;
  /** Present only when `ok` is true. */
  value?: NormalizedSetFavoriteInput;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Validate and normalize set-favorite input. Rules mirror the database:
 *  - a media slug is required (the trusted catalog identity, resolved
 *    server-side by the RPC — never trusted media metadata);
 *  - the desired state must be an explicit boolean.
 *
 * The slug is only WHICH title to act on; ownership is re-derived from
 * `auth.uid()` in the database and RLS applies, never trusted from the client.
 */
export function validateSetFavoriteInput(
  input: SetFavoriteInput,
): SetFavoriteValidationResult {
  const mediaSlug = trimOrNull(input.mediaSlug);
  if (!mediaSlug) {
    return {
      ok: false,
      message: "We couldn't tell which title to update. Please try again.",
    };
  }

  if (typeof input.isFavorite !== "boolean") {
    return {
      ok: false,
      message: "We couldn't tell whether to add or remove that favorite.",
    };
  }

  return { ok: true, value: { mediaSlug, isFavorite: input.isFavorite } };
}
