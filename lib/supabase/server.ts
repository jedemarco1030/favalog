import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { getPublicSupabaseEnv } from "./env";

/**
 * Cookie-aware Supabase client for Server Components, Server Actions, and Route
 * Handlers.
 *
 * A fresh client is created PER REQUEST (this function is async and reads the
 * request's cookies), as required by the `@supabase/ssr` model — there is
 * deliberately no shared global server client, which would leak one user's
 * session into another request.
 *
 * The `setAll` handler is wrapped in try/catch because `cookies()` is read-only
 * inside Server Components; writes there throw. In that case the session-refresh
 * `proxy.ts` layer is responsible for persisting refreshed cookies, so it is
 * safe to ignore the failure here. Server Actions and Route Handlers CAN write
 * cookies, so `setAll` succeeds and persists refreshed tokens there.
 */
export async function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are immutable.
          // `proxy.ts` refreshes the session cookies for these requests.
        }
      },
    },
  });
}
