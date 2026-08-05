/**
 * Pure, framework-agnostic validation and normalization for the auth/onboarding
 * forms. Everything here runs on the server (Server Actions) as the source of
 * truth; the same helpers can be reused for lightweight client-side hints.
 *
 * These rules deliberately mirror the database constraints in
 * `supabase/migrations/20260805150100_profiles.sql` so client-facing errors
 * match what the database would ultimately reject:
 *  - username: 3–30 chars, `[A-Za-z0-9_]`, stored case-insensitively (citext).
 *  - display_name: 1–80 chars.
 *  - bio: ≤ 500 chars; location: ≤ 120 chars.
 *
 * The database unique index on `username` remains the source of truth for
 * availability — these helpers validate *shape*, not uniqueness.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const BIO_MAX_LENGTH = 500;
export const LOCATION_MAX_LENGTH = 120;

/**
 * Minimum password length we enforce in the UI. Kept at 8 (stricter than
 * Supabase's default of 6) so the app never accepts a weaker password than it
 * advertises. Supabase remains the final authority.
 */
export const PASSWORD_MIN_LENGTH = 8;

const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const HAS_UPPERCASE = /[A-Z]/;

/**
 * The exact character/length rule the database enforces on `username`
 * (`profiles_username_format` + citext, case-insensitive). Unlike
 * {@link validateUsername}, this permits uppercase because the database does —
 * it answers "would the database accept this handle?", which is what
 * completeness checks need.
 */
const USERNAME_DB_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

/**
 * True when `username` satisfies the database's stored-shape constraint. Used
 * by profile-completeness checks (which must mirror the DB, not the stricter
 * lowercase nudge the sign-up/onboarding forms apply).
 */
export function hasValidUsernameShape(username: string): boolean {
  return USERNAME_DB_PATTERN.test(username.trim());
}

/**
 * Normalize an email for storage/lookup: trim surrounding whitespace and
 * lowercase it. Supabase also lowercases, so this keeps client-side hints and
 * the stored value consistent.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize a username to the canonical stored form: trimmed and lowercased.
 * The database column is `citext` (case-insensitive uniqueness), so lowercasing
 * makes the stored value predictable and keeps `/profile/[username]` URLs
 * lower-case like the rest of the app.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** A very small, permissive email shape check (server-side hint only). */
export function isLikelyEmail(email: string): boolean {
  const value = email.trim();
  if (value.length === 0 || value.length > 254) return false;
  // One `@`, non-empty local part, and a dotted domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Validate an email, returning a consumer-friendly error message or `null`
 * when it is acceptable.
 */
export function validateEmail(email: string): string | null {
  if (email.trim() === "") return "Enter your email address.";
  if (!isLikelyEmail(email)) return "Enter a valid email address.";
  return null;
}

/**
 * Validate a username against the same rules the database enforces. Expects a
 * value that has NOT yet been normalized so it can give precise feedback about
 * uppercase letters and length. Returns an error message or `null`.
 */
export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed === "") return "Choose a username.";
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return `Usernames must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return `Usernames must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }

  const normalized = normalizeUsername(trimmed);
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Usernames can use letters, numbers, and underscores only.";
  }
  // Surface the case-folding behaviour explicitly rather than silently
  // rewriting the value the person typed.
  if (HAS_UPPERCASE.test(trimmed)) {
    return "Usernames are lowercase — we'll store it in lowercase.";
  }
  return null;
}

/** Validate a display name (1–80 chars). Returns an error message or `null`. */
export function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (trimmed === "") return "Enter a display name.";
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display names must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Validate a password's length. Returns an error message or `null`. */
export function validatePassword(password: string): string | null {
  if (password === "") return "Enter a password.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Passwords must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return null;
}

/**
 * Confirm two password entries match. Returns an error message or `null`.
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (confirmation === "") return "Re-enter your password to confirm it.";
  if (password !== confirmation) return "Those passwords don't match.";
  return null;
}

/** Validate an optional bio (≤ 500 chars). Returns an error message or `null`. */
export function validateBio(bio: string): string | null {
  if (bio.trim().length > BIO_MAX_LENGTH) {
    return `Bios must be ${BIO_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Validate an optional location (≤ 120 chars). Returns an error or `null`. */
export function validateLocation(location: string): string | null {
  if (location.trim().length > LOCATION_MAX_LENGTH) {
    return `Location must be ${LOCATION_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}
