import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured } from "./env";

/**
 * Refresh the Supabase auth session cookies for an incoming request.
 *
 * This is the session-refresh infrastructure invoked from the root `proxy.ts`
 * (Next.js 16's renamed middleware convention). Its ONLY job is to keep the
 * auth cookies fresh so Server Components see a valid session — it intentionally
 * performs NO route authorization or redirects. Route protection is a later
 * authentication task.
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
  // Do NOT run any logic between client creation and this call, and do NOT gate
  // on the result here (no redirects) — this is refresh-only.
  await supabase.auth.getUser();

  return response;
}
