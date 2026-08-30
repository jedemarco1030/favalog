/**
 * Server-only Supabase admin (service-role) client for trusted catalog writes.
 *
 * Materialization must write to `public.media_items`, which browser roles cannot
 * do; it therefore runs through a service-role client, exactly like the existing
 * embedding pipeline. The service-role key is read ONLY here, on the server,
 * from `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`), and is
 * never exposed to the browser, logged, or returned.
 *
 * This module does NOT read `next/headers`, so it is safe to import from both a
 * server request context and the operator CLI. It never throws at import time;
 * {@link createCatalogAdminClient} throws only when actually invoked without
 * configuration, so a build with no Supabase env still succeeds.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/** Resolve the service-role URL + key, or `null` when unconfigured. */
export function getCatalogAdminEnv(): { url: string; key: string } | null {
  const url = (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  const key = (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

/** Non-throwing check for whether the admin (service-role) client is configured. */
export function isCatalogAdminConfigured(): boolean {
  return getCatalogAdminEnv() !== null;
}

/**
 * Build a service-role Supabase client for trusted server-side catalog writes.
 * Throws a descriptive error when the service-role env is missing, so a
 * misconfiguration surfaces at the call site rather than silently producing a
 * broken client.
 */
export function createCatalogAdminClient(): SupabaseClient<Database> {
  const env = getCatalogAdminEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase admin configuration: set SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY (service-role) to materialize catalog titles.",
    );
  }
  return createClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
