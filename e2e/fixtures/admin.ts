import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase helpers for the fixture-backed E2E suite.
 *
 * These run in the Playwright RUNNER process (not the app), so they need the
 * local Supabase URL + service-role key that `playwright.config.ts` loads from
 * `.env.local` for the fixtures suites. They are used only to provision a test
 * user and to make authoritative "exactly once / no duplicate" assertions
 * against local Supabase. No secrets are hard-coded here.
 */

/** The deterministic test account provisioned for authenticated fixtures specs. */
export const FIXTURE_USER = {
  email: "e2e-materialize@example.com",
  password: "Fixture-Passw0rd!23",
  username: "e2ematerialize",
  displayName: "E2E Materialize",
} as const;

function requireEnv(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback ?? "").trim();
  if (!value) {
    throw new Error(
      `[e2e fixtures] Missing ${name}. The fixtures suite needs local Supabase ` +
        `credentials from .env.local (run "npm run supabase:start").`,
    );
  }
  return value;
}

/** Build a service-role admin client against local Supabase. */
export function createAdminClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = requireEnv(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Ensure the fixture user exists as a CONFIRMED, ONBOARDED account. The
 * `handle_new_user` trigger provisions a complete profile from the supplied
 * `user_metadata` (username + display_name), so the account is onboarding-clean
 * on a freshly reset local database.
 */
export async function ensureFixtureUser(): Promise<void> {
  const admin = createAdminClient();

  // Remove any pre-existing account for a deterministic starting point.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === FIXTURE_USER.email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { error } = await admin.auth.admin.createUser({
    email: FIXTURE_USER.email,
    password: FIXTURE_USER.password,
    email_confirm: true,
    user_metadata: {
      username: FIXTURE_USER.username,
      display_name: FIXTURE_USER.displayName,
    },
  });
  if (error) {
    throw new Error(
      `[e2e fixtures] Failed to create fixture user: ${error.message}`,
    );
  }
}

/**
 * Count catalog rows matching a `(source, external_id)` identity — the
 * authoritative "materialized exactly once / no duplicate" check.
 */
export async function countMediaByExternalId(
  source: string,
  externalId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("source", source)
    .eq("external_id", externalId);
  if (error) {
    throw new Error(
      `[e2e fixtures] Count by external id failed: ${error.message}`,
    );
  }
  return count ?? 0;
}

/** Count catalog rows for a given slug (used to prove no duplicate title). */
export async function countMediaBySlug(slug: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("slug", slug);
  if (error) {
    throw new Error(`[e2e fixtures] Count by slug failed: ${error.message}`);
  }
  return count ?? 0;
}
