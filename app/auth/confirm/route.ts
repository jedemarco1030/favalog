import { NextResponse, type NextRequest } from "next/server";

import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { resolvePostCallbackPath } from "../post-auth";

/**
 * Email confirmation / recovery verification (Route Handler).
 *
 * Verifies a `token_hash` using the current supported server method
 * (`verifyOtp`) — NOT the deprecated implicit-flow URL fragment. Supabase email
 * templates should point their confirmation link at this route
 * (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=...`).
 *
 * Recovery is kept distinct from sign-up/confirmation: a `recovery` link goes
 * straight to the validated `next` (the update-password screen) rather than the
 * onboarding decision used for a newly-confirmed account.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeRedirectPath(searchParams.get("next"), "/");

  if (!isAuthAvailable() || !tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=confirmation_failed`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=confirmation_expired`,
    );
  }

  // A recovery link must reach the update-password screen, not onboarding.
  if (type === "recovery") {
    const recoveryNext = next !== "/" ? next : "/auth/update-password";
    return NextResponse.redirect(`${origin}${recoveryNext}`);
  }

  const destination = await resolvePostCallbackPath(supabase, next);
  return NextResponse.redirect(`${origin}${destination}`);
}
