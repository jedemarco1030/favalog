import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getCurrentProfile, requireUser } from "@/lib/auth/data";
import { isProfileComplete } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Set up your profile",
  description: "Choose your username and display name to finish setting up.",
};

/**
 * First-time onboarding. This is an account-only route:
 *  - unauthenticated visitors are redirected to sign-in with a safe returnTo;
 *  - authenticated users whose profile is already complete are sent to their
 *    profile (they should never linger here);
 *  - everyone else gets the completion form, prefilled from the initial profile
 *    the DB trigger created (or auth metadata) where we already have a value.
 *
 * Authorization is enforced here in the Server Component and again in the
 * `completeOnboardingAction` — the proxy only performs an optimistic redirect.
 */
export default async function OnboardingPage() {
  if (!isAuthAvailable()) redirect("/");

  const user = await requireUser("/onboarding");
  const profile = await getCurrentProfile();

  if (profile && isProfileComplete(profile)) {
    redirect(`/profile/${profile.username}`);
  }

  const metadata = user.user_metadata ?? {};
  const defaultUsername =
    profile?.username ??
    (typeof metadata.username === "string" ? metadata.username : undefined);
  const defaultDisplayName =
    profile?.displayName ??
    (typeof metadata.display_name === "string"
      ? metadata.display_name
      : typeof metadata.full_name === "string"
        ? metadata.full_name
        : undefined);

  return (
    <AuthFormShell
      title="Set up your profile"
      subtitle="Pick a username and display name. You can add a bio and location now or later."
    >
      <OnboardingForm
        defaultUsername={defaultUsername}
        defaultDisplayName={defaultDisplayName}
      />
    </AuthFormShell>
  );
}
