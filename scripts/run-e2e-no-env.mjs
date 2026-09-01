#!/usr/bin/env node
/**
 * Run the no-env Playwright suite with Supabase/provider credentials EXPLICITLY
 * REMOVED (not merely inherited-and-ignored).
 *
 * The no-env suite proves Explore's intentional editorial/unavailable fallback
 * when `isSupabaseConfigured()` is false. That requires a build produced with
 * the public Supabase vars blanked (so they are not inlined) AND a runtime that
 * never picks up the hosted `.env.local`. Because a pre-set `process.env` value
 * wins over Next's `.env.local`, blanking every Supabase/provider key here (to
 * an empty string) guarantees the hosted values can never take effect during
 * either `next build` or `next start`. No local credentials are supplied, so
 * this suite is not mutation-capable.
 */

import { spawnSync } from "node:child_process";

/** Every Supabase/provider var that could otherwise leak in from `.env.local`. */
const BLANK_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "EXTERNAL_CATALOG_ENABLED",
  "TMDB_ENABLED",
  "OPEN_LIBRARY_ENABLED",
  "TMDB_API_READ_TOKEN",
  "OPEN_LIBRARY_CONTACT_EMAIL",
  // Never honour a stray transport override in the no-env suite.
  "CATALOG_TEST_TRANSPORT",
  "CATALOG_TEST_TMDB_BASE_URL",
  "CATALOG_TEST_OPENLIBRARY_BASE_URL",
];

/** @type {Record<string, string | undefined>} */
const scrubbed = { ...process.env };
for (const key of BLANK_KEYS) scrubbed[key] = "";

function run(cmd, args, extra = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...scrubbed, ...extra },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(
  "[e2e no-env] Building with Supabase/provider credentials removed…",
);
run("npm", ["run", "build"]);

console.log('[e2e no-env] Running Playwright suite "no-env"…');
run("npx", ["playwright", "test"], { E2E_SUITE: "no-env" });
