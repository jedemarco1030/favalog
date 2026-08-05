import type { Metadata } from "next";
import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthMessage } from "@/components/auth/auth-message";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { authLinkClass } from "@/components/auth/link-styles";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getCurrentUser } from "@/lib/auth/data";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your Favalog account.",
};

/**
 * Update-password screen. This route requires a valid recovery/session context
 * (established by following a reset link through `/auth/confirm`). Authorization
 * happens HERE in the Server Component (and again in the Server Action) — not
 * only in the proxy. Without a session we show a clear "invalid/expired" state
 * with a path back to request a fresh link, rather than an empty form.
 */
export default async function UpdatePasswordPage() {
  const authAvailable = isAuthAvailable();
  const user = authAvailable ? await getCurrentUser() : null;

  return (
    <AuthFormShell
      title="Set a new password"
      subtitle="Choose a new password to finish resetting your account."
      footer={
        <p>
          <Link href="/" className={authLinkClass}>
            Return to Favalog
          </Link>
        </p>
      }
    >
      {!authAvailable && (
        <AuthMessage variant="info">
          Accounts aren&apos;t available in this environment yet — you can keep
          browsing Favalog.
        </AuthMessage>
      )}

      {authAvailable && !user && (
        <AuthMessage variant="error">
          This password reset link is invalid or has expired.{" "}
          <Link href="/auth/forgot-password" className={authLinkClass}>
            Request a new one
          </Link>
          .
        </AuthMessage>
      )}

      {authAvailable && user && <UpdatePasswordForm />}
    </AuthFormShell>
  );
}
