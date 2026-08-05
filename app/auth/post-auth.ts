import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { isProfileComplete } from "@/lib/auth/profile";

/**
 * Decide where a request lands after a successful protocol callback (OAuth code
 * exchange or email confirmation), using the SAME request-scoped Supabase
 * client that just established the session.
 *
 * Onboarding takes priority: a user whose profile is not yet complete is sent
 * to `/onboarding`. Otherwise they go to the already-validated `next` path, or
 * to their own profile. `next` MUST be a safe same-origin path
 * (`getSafeRedirectPath`) before it reaches here.
 */
export async function resolvePostCallbackPath(
  supabase: SupabaseClient<Database>,
  next: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/auth/sign-in?error=callback_failed";

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    !isProfileComplete({
      username: profile.username,
      displayName: profile.display_name,
    })
  ) {
    return "/onboarding";
  }

  return next !== "" && next !== "/" ? next : `/profile/${profile.username}`;
}
