/**
 * Safe "return-to" redirect validation.
 *
 * Every place that accepts a caller-supplied redirect target (sign-in
 * `returnTo`, OAuth `next`, email-confirmation `next`) MUST funnel the value
 * through {@link getSafeRedirectPath}. This is a mandatory security boundary:
 * an unvalidated redirect is an open-redirect / phishing vector, so we accept
 * ONLY same-origin, relative paths and fall back to a trusted default for
 * anything suspicious.
 *
 * Accepted: a single leading slash followed by a path, e.g. `/`, `/explore`,
 * `/profile/jamie?tab=lists#top`.
 *
 * Rejected (returns the fallback):
 *  - absolute URLs: `https://evil.example/phish`
 *  - protocol-relative URLs: `//evil.example`
 *  - scheme-only / javascript URLs: `javascript:alert(1)`, `mailto:x`
 *  - backslash tricks some browsers normalize to `//`: `/\evil.example`
 *  - values containing control characters, whitespace, or newlines
 *  - anything that is not a string, or is empty after trimming
 */

/** The default destination used whenever a candidate value is unsafe. */
export const DEFAULT_REDIRECT = "/";

/**
 * Return `value` when it is a safe same-origin relative path, otherwise
 * `fallback`. See the module docstring for the exact accept/reject rules.
 */
export function getSafeRedirectPath(
  value: unknown,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (candidate === "") return fallback;

  // Must be a path rooted at the current origin.
  if (!candidate.startsWith("/")) return fallback;

  // Reject protocol-relative (`//host`) and backslash-normalized (`/\host`)
  // forms that browsers can treat as absolute URLs to another origin.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }

  // Reject control characters, whitespace, and backslashes anywhere in the
  // value. Whitespace is not valid in a URL path and backslashes are used in
  // several open-redirect bypasses.
  if (/[\u0000-\u001f\u007f\s\\]/.test(candidate)) {
    return fallback;
  }

  return candidate;
}
