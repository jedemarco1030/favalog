/**
 * Profile-completeness rules for onboarding.
 *
 * Completeness is defined *minimally*, per the product decision: a profile is
 * complete once it has a valid username and a non-empty display name. Optional
 * fields (bio, location, avatar) never gate completion.
 *
 * Why this matters: the database trigger `handle_new_user` provisions an
 * initial profile for every new auth user, but an OAuth sign-in or partial
 * sign-up metadata can leave a profile that is present-but-not-yet-owned (for
 * example a fallback `user_xxxxxxxx` handle). `/onboarding` uses this check to
 * decide whether the person still needs to choose their identity, and to send
 * already-complete users straight to their profile.
 */

import type { Profile } from "@/lib/types";
import { hasValidUsernameShape } from "./validation";

/**
 * The minimal fields required to judge completeness. Accepting a structural
 * subset (rather than the whole {@link Profile}) keeps this usable with partial
 * data and trivial to unit-test.
 */
export type ProfileCompletenessInput = Pick<
  Profile,
  "username" | "displayName"
> | null;

/**
 * True when the profile has a valid username and a non-empty display name.
 * A missing/`null` profile is never complete.
 */
export function isProfileComplete(profile: ProfileCompletenessInput): boolean {
  if (!profile) return false;
  if (!hasValidUsernameShape(profile.username)) return false;
  if (profile.displayName.trim() === "") return false;
  return true;
}
