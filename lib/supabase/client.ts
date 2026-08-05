import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { getPublicSupabaseEnv } from "./env";

/**
 * Browser Supabase client for use inside Client Components.
 *
 * Uses the public URL + publishable key only (both `NEXT_PUBLIC_`), so nothing
 * privileged is ever shipped to the browser. `createBrowserClient` from
 * `@supabase/ssr` is the current supported way to read the auth session from
 * cookies on the client — do NOT use the deprecated `@supabase/auth-helpers-*`
 * packages.
 *
 * A new client is created per call; `@supabase/ssr` memoizes the underlying
 * singleton in the browser, so this is cheap and there is no shared global to
 * leak between users.
 */
export function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
