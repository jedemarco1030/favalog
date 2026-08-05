/**
 * Auth environment capability detection.
 *
 * The app must build and render on mock data with NO Supabase environment
 * variables set (the current preview standard). These pure predicates let the
 * UI decide what to show without ever throwing at import time:
 *
 *  - {@link isAuthAvailable} — is the public Supabase config present at all?
 *  - {@link isGoogleOAuthEnabled} — is "Continue with Google" turned on?
 *
 * Provider availability is a *public* build-time flag
 * (`NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED`), never a secret: the actual Google
 * client id/secret live only in the Supabase dashboard. The flag simply lets us
 * hide the button in environments where Google is not configured, so users
 * never hit an opaque provider error.
 */

import { isSupabaseConfigured } from "@/lib/supabase/env";

/** True when the public Supabase URL + publishable key are configured. */
export function isAuthAvailable(): boolean {
  return isSupabaseConfigured();
}

/**
 * True when Google OAuth should be offered. Requires both that Supabase auth is
 * available and that the deployment has explicitly opted in via the public
 * `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED=true` flag.
 */
export function isGoogleOAuthEnabled(): boolean {
  return (
    isAuthAvailable() &&
    process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED === "true"
  );
}

/** A small, serializable snapshot of auth capability for passing to the UI. */
export interface AuthCapability {
  available: boolean;
  google: boolean;
}

/** Read the current auth capability as a plain object. */
export function getAuthCapability(): AuthCapability {
  return { available: isAuthAvailable(), google: isGoogleOAuthEnabled() };
}
