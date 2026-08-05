/**
 * Map Supabase auth errors to safe, consumer-friendly messages.
 *
 * Two rules drive this module:
 *  1. Never surface raw Supabase/postgres error strings to the browser — they
 *     leak implementation detail and read like a stack trace.
 *  2. Never confirm whether a given email belongs to an account. Sign-up and
 *     password-reset flows must stay neutral to avoid account enumeration.
 *
 * Matching is done primarily on the stable `code` an `AuthApiError` carries,
 * with a small message-substring fallback for older error shapes. Anything
 * unrecognized collapses to a single generic message.
 */

/** Generic fallback shown when we cannot (or should not) be specific. */
export const GENERIC_AUTH_ERROR =
  "Something went wrong. Please try again in a moment.";

/**
 * Shape we read from a Supabase error without importing its class (keeps this
 * module pure and trivially testable). `AuthApiError` exposes `code`, `status`,
 * and `message`.
 */
interface SupabaseLikeError {
  code?: string;
  status?: number;
  message?: string;
}

function asSupabaseError(error: unknown): SupabaseLikeError {
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    return {
      code: typeof e.code === "string" ? e.code : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
      message: typeof e.message === "string" ? e.message : undefined,
    };
  }
  return {};
}

/**
 * Translate an auth error into a message safe to render to the user.
 *
 * `context` lets callers keep enumeration-sensitive flows neutral: in a
 * `sign-up` or `reset` context an "already registered" error is intentionally
 * NOT distinguished from success by this mapper.
 */
export function mapAuthError(
  error: unknown,
  context: "sign-in" | "sign-up" | "reset" | "update" | "generic" = "generic",
): string {
  if (!error) return GENERIC_AUTH_ERROR;

  const { code, status, message } = asSupabaseError(error);
  const haystack = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  // Rate limiting — same wording everywhere.
  if (
    status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    haystack.includes("rate limit")
  ) {
    return "Too many attempts. Please wait a little while and try again.";
  }

  if (code === "invalid_credentials" || haystack.includes("invalid login")) {
    return "The email or password you entered is incorrect.";
  }

  if (code === "email_not_confirmed" || haystack.includes("not confirmed")) {
    return "Please confirm your email address, then sign in.";
  }

  if (code === "weak_password" || haystack.includes("weak password")) {
    return "Please choose a stronger password.";
  }

  if (code === "same_password" || haystack.includes("should be different")) {
    return "Your new password must be different from the current one.";
  }

  if (
    code === "session_not_found" ||
    code === "flow_state_not_found" ||
    code === "flow_state_expired"
  ) {
    return "This link is invalid or has expired. Please request a new one.";
  }

  if (context === "sign-up" || context === "reset") {
    // Stay neutral: do not reveal whether the address is already registered.
    return GENERIC_AUTH_ERROR;
  }

  return GENERIC_AUTH_ERROR;
}

/**
 * Map a KNOWN `?error=` query code (set by our own callbacks/actions) to a safe
 * message, or `null` for an unrecognized code. Auth pages must render only the
 * result of this allow-list — never the raw query parameter — so an attacker
 * cannot inject arbitrary text via the URL.
 */
export function describeAuthQueryError(code: string | null): string | null {
  switch (code) {
    case "oauth_failed":
      return "We couldn't sign you in with Google. Please try again.";
    case "oauth_unavailable":
      return "Google sign-in isn't available right now. Try email instead.";
    case "confirmation_failed":
      return "That confirmation link is invalid. Please request a new one.";
    case "confirmation_expired":
      return "That confirmation link has expired. Please request a new one.";
    case "callback_failed":
      return "We couldn't complete that sign-in. Please try again.";
    default:
      return null;
  }
}
