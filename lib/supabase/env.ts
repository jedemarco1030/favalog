/**
 * Safe access to Supabase environment configuration.
 *
 * Only the *public* Supabase URL and publishable key are read here, and both
 * use the `NEXT_PUBLIC_` prefix so they may travel to the browser. The secret
 * (service-role) key is deliberately NOT read in this module — it must never be
 * bundled into client code. Server-only administrative code that needs it
 * should read `process.env.SUPABASE_SECRET_KEY` directly in a server context.
 *
 * IMPORTANT: nothing here throws at module import time. The existing frontend
 * runs entirely on mock data and must keep building and rendering on Vercel
 * without any Supabase variables set. Validation is opt-in via
 * `getPublicSupabaseEnv()`, which callers invoke only when they actually need a
 * client.
 */

/** The public Supabase configuration needed to construct a browser/server client. */
export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

/**
 * Read and validate the public Supabase environment variables.
 *
 * Throws a descriptive error if either variable is missing or blank, so a
 * misconfiguration surfaces clearly at the call site (when a client is
 * requested) rather than silently producing a broken client. This is only
 * reached once Supabase is actually wired into a route, never during an
 * ordinary mock-data build.
 */
export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const missing: string[] = [];
  if (!url || url.trim() === "") missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey || publishableKey.trim() === "") {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and fill in the values from " +
        "`npx supabase status` (local) or your Supabase project settings.",
    );
  }

  return { url: url as string, publishableKey: publishableKey as string };
}

/**
 * Non-throwing check for whether the public Supabase environment is configured.
 * Useful for feature flags that keep the app on mock data until the backend is
 * wired in.
 */
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  );
}
