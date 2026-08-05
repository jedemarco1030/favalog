import type { Metadata } from "next";
import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignInForm } from "@/components/auth/sign-in-form";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { isAuthAvailable, isGoogleOAuthEnabled } from "@/lib/auth/capability";
import { describeAuthQueryError } from "@/lib/auth/errors";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { authLinkClass } from "@/components/auth/link-styles";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Favalog.",
};

interface SignInPageProps {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const safeReturnTo = getSafeRedirectPath(params.returnTo, "");
  const returnTo =
    safeReturnTo !== "" && safeReturnTo !== "/" ? safeReturnTo : undefined;
  const queryError = describeAuthQueryError(params.error ?? null);

  const signUpHref = returnTo
    ? `/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/sign-up";

  return (
    <AuthFormShell
      title="Welcome back"
      subtitle="Sign in to pick up your Favalog where you left off."
      footer={
        <>
          <p>
            New to Favalog?{" "}
            <Link href={signUpHref} className={authLinkClass}>
              Create an account
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
      {queryError && <AuthMessage variant="error">{queryError}</AuthMessage>}

      <SignInForm returnTo={returnTo} />

      <p className="text-sm">
        <Link href="/auth/forgot-password" className={authLinkClass}>
          Forgot your password?
        </Link>
      </p>

      {isGoogleOAuthEnabled() && (
        <>
          <OrDivider />
          <GoogleButton returnTo={returnTo} />
        </>
      )}
    </AuthFormShell>
  );
}
