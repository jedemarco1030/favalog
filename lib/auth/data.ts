import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { User as SupabaseUser } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { mapProfileRowToDomain } from "@/lib/supabase/mappers";
import type { Profile } from "@/lib/types";
import { isProfileComplete } from "./profile";
import { getSafeRedirectPath } from "./safe-redirect";

/**
 * Server-only auth data layer (the "DAL" from the Next.js auth guide).
 *
 * This is the primary authorization boundary — never the proxy. Every one of
 * these helpers runs `supabase.auth.getUser()`, which VALIDATES the session
 * with the Supabase Auth server rather than trusting raw cookie contents (do
 * NOT use `getSession()` for authorization decisions).
 *
 * The read helpers are wrapped in React `cache()` so a single render/request
 * that reads the current user in several places (header, page, action) only
 * validates once — the recommended Next.js 16 pattern. The functions are
 * deliberately distinct so each call site states exactly what it needs:
 *
 *  - {@link getCurrentUser}     — the authenticated auth user, or `null`.
 *  - {@link getCurrentProfile}  — the current user's public profile, or `null`.
 *  - {@link requireUser}        — authenticated, else redirect to sign-in.
 *  - {@link requireCompleteProfile} — authenticated + onboarded, else redirect.
 */

/**
 * The current authenticated auth user (validated with the Auth server), or
 * `null` when signed out / on any auth error. Never throws for an anonymous
 * request.
 */
export const getCurrentUser = cache(async (): Promise<SupabaseUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * The current user's public profile row mapped to the {@link Profile} domain
 * type, or `null` when signed out or the row is missing. Reading the public
 * profile is intentionally separate from reading the auth user so callers do
 * not conflate identity data with an authorization check.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileRowToDomain(data);
});

/**
 * Require an authenticated user. On success returns the user; otherwise
 * redirects to `/auth/sign-in`, preserving a validated `returnTo` path so the
 * person lands back where they started after signing in.
 */
export async function requireUser(returnTo?: string): Promise<SupabaseUser> {
  const user = await getCurrentUser();
  if (user) return user;

  const target = returnTo ? getSafeRedirectPath(returnTo, "/") : "/";
  const query =
    target && target !== "/" ? `?returnTo=${encodeURIComponent(target)}` : "";
  redirect(`/auth/sign-in${query}`);
}

/**
 * Require an authenticated user whose profile is complete. Redirects to
 * `/auth/sign-in` when signed out, or to `/onboarding` when the profile still
 * needs completion. On success returns both the user and the complete profile.
 */
export async function requireCompleteProfile(
  returnTo?: string,
): Promise<{ user: SupabaseUser; profile: Profile }> {
  const user = await requireUser(returnTo);
  const profile = await getCurrentProfile();
  if (!profile || !isProfileComplete(profile)) {
    redirect("/onboarding");
  }
  return { user, profile };
}
