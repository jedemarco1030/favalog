#!/usr/bin/env node
/**
 * Run a fixture-backed Playwright suite against LOCAL Supabase ONLY.
 *
 * WHY THIS EXISTS: this repo's `.env.local` points at a HOSTED Supabase project.
 * The fixture-backed E2E suite provisions a user and materializes titles, which
 * MUST never touch hosted. This runner deliberately does NOT read `.env.local`.
 * Instead it resolves the LOCAL Supabase credentials from `supabase status`,
 * hard-verifies the API URL is loopback, and injects them (as NEXT_PUBLIC_* for
 * the build and as server-only vars for the run) so both `next build` and
 * `next start` — and the Playwright runner's admin helper — target 127.0.0.1.
 *
 * Usage: node scripts/run-e2e-fixtures.mjs <fixtures|fixtures-prod-reject>
 */

import { execFileSync, spawnSync } from "node:child_process";

const suite = process.argv[2];
if (suite !== "fixtures" && suite !== "fixtures-prod-reject") {
  console.error(
    "Usage: node scripts/run-e2e-fixtures.mjs <fixtures|fixtures-prod-reject>",
  );
  process.exit(2);
}

/** Parse `supabase status -o env` into a plain object. */
function readLocalSupabaseEnv() {
  let raw;
  try {
    raw = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
    });
  } catch {
    // Fall back to the local CLI shipped in node_modules.
    raw = execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
      encoding: "utf8",
    });
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const local = readLocalSupabaseEnv();
const apiUrl = local.API_URL ?? "";

// HARD SAFETY GUARD: refuse to run unless Supabase is unmistakably LOCAL. This
// makes it impossible for this suite to build/run against a hosted project.
let host;
try {
  host = new URL(apiUrl).hostname;
} catch {
  host = "";
}
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
if (!LOOPBACK.has(host)) {
  console.error(
    `[e2e fixtures] Refusing to run: local Supabase API URL is not loopback ` +
      `(got "${apiUrl}"). Start it with "npm run supabase:start".`,
  );
  process.exit(1);
}

const publishable = local.PUBLISHABLE_KEY ?? local.ANON_KEY ?? "";
const secret = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY ?? "";

// Local Supabase credentials for BOTH the build (NEXT_PUBLIC_* is inlined at
// build time; a pre-set process.env value wins over .env.local) and the run
// (server-only vars + the Playwright runner's admin helper).
const localEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY ?? "",
  SUPABASE_URL: apiUrl,
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY ?? secret,
  // No compatible embedding corpus locally; keep search keyword-only so no
  // OpenAI/network call is made during E2E.
  SEMANTIC_SEARCH_ENABLED: "false",
  E2E_SUITE: suite,
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: localEnv });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`[e2e fixtures] Local Supabase: ${apiUrl}`);
console.log(`[e2e fixtures] Building against local Supabase…`);
run("npm", ["run", "build"]);

console.log(`[e2e fixtures] Running Playwright suite "${suite}"…`);
run("npx", ["playwright", "test"]);
