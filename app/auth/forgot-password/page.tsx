import type { Metadata } from "next";
import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthMessage } from "@/components/auth/auth-message";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { authLinkClass } from "@/components/auth/link-styles";
import { isAuthAvailable } from "@/lib/auth/capability";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a link to reset your Favalog password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new password."
      footer={
        <>
          <p>
            Remembered it?{" "}
            <Link href="/auth/sign-in" className={authLinkClass}>
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

      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
