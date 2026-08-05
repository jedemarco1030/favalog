import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured } from "./env";

/**
 * Refresh the Supabase auth session cookies for an incoming request.
 *
 * This is the session-refresh infrastructure invoked from the root `proxy.ts`
 * (Next.js 16's renamed middleware convention). Its primary job is to keep the
 * auth cookies fresh so Server Components see a valid session. It ALSO performs
 * a single, optimistic UX redirect for the account-only `/onboarding` route —
 * this is deliberately not the security boundary (the protected Server
 * Component and Server Action re-check authorization via the DAL).
 *
 * If Supabase is not configured (the current mock-data deployment), it is a
 * no-op that simply forwards the request, so the app keeps working with no
 * Supabase environment variables set.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Keep the app fully functional on mock data with no Supabase env present.
  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Touch the auth state so `@supabase/ssr` rotates/refreshes cookies as needed.
  // Do NOT run any logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // OPTIMISTIC redirect only — this is a UX convenience, NOT the security
  // boundary. Real authorization is enforced again in the protected Server
  // Component / Server Action (see `requireUser`). We keep the account-only
  // surface here deliberately tiny: `/onboarding`. Public routes stay public.
  const { pathname } = request.nextUrl;
  if (!user && pathname.startsWith("/onboarding")) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}
