import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { resolvePostCallbackPath } from "../post-auth";

/**
 * OAuth / PKCE callback (Route Handler).
 *
 * This endpoint exists ONLY to exchange an authorization `code` for a session
 * server-side. Email confirmation and password recovery are handled separately
 * by `/auth/confirm` (token-hash verification) so the two protocols never share
 * one ambiguous callback.
 *
 * The `next` query param is validated to a safe same-origin path before use.
 * The session cookies written by `exchangeCodeForSession` are applied to the
 * redirect response via the SSR cookie adapter.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"), "/");

  if (!isAuthAvailable() || !code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth_failed`);
  }

  const destination = await resolvePostCallbackPath(supabase, next);
  return NextResponse.redirect(`${origin}${destination}`);
}
