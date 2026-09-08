/**
 * Pure input validation for the persistent follow lifecycle.
 *
 * Kept intentionally free of React/server/Supabase dependencies so it can be
 * shared by the client form (immediate feedback), the Server Action, and the
 * data layer (authoritative validation), and tested in isolation.
 */

export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,30}$/;

export interface SetFollowInput {
  username: string;
  isFollow: boolean;
}

export interface NormalizedSetFollowInput {
  username: string;
  isFollow: boolean;
}

export interface SetFollowValidationResult {
  ok: boolean;
  message?: string;
  value?: NormalizedSetFollowInput;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Validate and normalize set-follow input:
 *  - username must be 3..30 characters of alphanumeric or underscore;
 *  - isFollow must be an explicit boolean.
 */
export function validateSetFollowInput(
  input: SetFollowInput,
): SetFollowValidationResult {
  const username = trimOrNull(input.username);
  if (!username) {
    return { ok: false, message: "A username is required." };
  }

  if (
    username.length < 3 ||
    username.length > 30 ||
    !USERNAME_REGEX.test(username)
  ) {
    return {
      ok: false,
      message: "Username must be 3–30 letters, numbers, or underscores.",
    };
  }

  if (typeof input.isFollow !== "boolean") {
    return { ok: false, message: "A desired follow state is required." };
  }

  return {
    ok: true,
    value: {
      username,
      isFollow: input.isFollow,
    },
  };
}
