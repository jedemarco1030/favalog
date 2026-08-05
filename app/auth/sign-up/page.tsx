import type { Metadata } from "next";
import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { authLinkClass } from "@/components/auth/link-styles";
import { isAuthAvailable, isGoogleOAuthEnabled } from "@/lib/auth/capability";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Start your Favalog.",
};

interface SignUpPageProps {
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const safeReturnTo = getSafeRedirectPath(params.returnTo, "");
  const returnTo =
    safeReturnTo !== "" && safeReturnTo !== "/" ? safeReturnTo : undefined;

  const signInHref = returnTo
    ? `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/sign-in";

  return (
    <AuthFormShell
      title="Start your Favalog"
      subtitle="One home for everything you watch and read."
      footer={
        <>
          <p>
            Already have an account?{" "}
            <Link href={signInHref} className={authLinkClass}>
              Sign in
            </Link>
          </p>
          <p>
            <Link href="/" className={authLinkClass}>
              Return to Favalog
            </Link>
          </p>
        </>
      }
    >
      {!isAuthAvailable() && (
        <AuthMessage variant="info">
          Accounts aren&apos;t available in this environment yet — you can keep
          browsing Favalog.
        </AuthMessage>
      )}

      <SignUpForm />

      {isGoogleOAuthEnabled() && (
        <>
          <OrDivider />
          <GoogleButton returnTo={returnTo} />
        </>
      )}
    </AuthFormShell>
  );
}
