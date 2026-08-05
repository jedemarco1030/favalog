import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/data";
import { isAuthAvailable } from "@/lib/auth/capability";
import { isProfileComplete } from "@/lib/auth/profile";
import { AccountMenu } from "./account-menu";
import { SignedOutControls } from "./signed-out-controls";

const menuItemClass =
  "block w-full px-4 py-2 text-left text-sm text-foreground/80 outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground";

/**
 * Server-rendered auth cluster for the app shell.
 *
 * The session is read on the SERVER via the DAL (validated `getUser()`), so the
 * correct control ships in the initial HTML — no localStorage check, no
 * client-side auth flash. When Supabase is not configured we skip the session
 * read entirely (the env helpers never throw) and simply show the signed-out
 * controls; the auth pages themselves present the controlled unavailable state.
 */
export async function HeaderAuth() {
  const user = isAuthAvailable() ? await getCurrentUser() : null;
  if (!user) {
    return <SignedOutControls />;
  }

  const profile = await getCurrentProfile();
  const complete = isProfileComplete(profile);
  const displayName = profile?.displayName ?? user.email ?? "Your account";
  const profileHref =
    profile && complete ? `/profile/${profile.username}` : "/onboarding";
  const profileLabel = complete ? "View profile" : "Finish setup";

  return (
    <AccountMenu displayName={displayName} avatarUrl={profile?.avatarUrl}>
      <Link href={profileHref} role="menuitem" className={menuItemClass}>
        {profileLabel}
      </Link>
      <form action={signOutAction}>
        <button type="submit" role="menuitem" className={menuItemClass}>
          Sign out
        </button>
      </form>
    </AccountMenu>
  );
}
