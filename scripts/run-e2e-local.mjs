#!/usr/bin/env node
/**
 * Run a mutation-capable Playwright suite against LOCAL Supabase ONLY.
 *
 * WHY THIS EXISTS: this repo's `.env.local` points at a HOSTED Supabase project.
 * Every mutation-capable suite — the ordinary `configured` suite (auth, diary,
 * lists, favorites, …) AND the fixtures suites (federated Explore + on-demand
 * materialization) — provisions users and writes rows, so it MUST never touch
 * hosted. This runner deliberately does NOT read `.env.local`. Instead it
 * resolves LOCAL Supabase credentials through the shared, tested guard
 * (`scripts/lib/local-supabase-target.mjs`), which HARD-VERIFIES every relevant
 * Supabase URL is loopback BEFORE anything is built, started, or run, then
 * injects them (as `NEXT_PUBLIC_*` for the build, where they are inlined, and as
 * server-only vars for the run). A pre-set `process.env` value wins over Next's
 * `.env.local`, so this fully neutralises the hosted config for both phases.
 *
 * There is deliberately NO flag that permits a hosted target.
 *
 * Usage: node scripts/run-e2e-local.mjs <configured|fixtures|fixtures-prod-reject>
 */

import { spawnSync } from "node:child_process";

import {
  describeSupabaseTarget,
  resolveLocalSupabaseTestEnv,
} from "./lib/local-supabase-target.mjs";

const suite = process.argv[2];
const ALLOWED = new Set(["configured", "fixtures", "fixtures-prod-reject"]);
if (!ALLOWED.has(suite)) {
  console.error(
    "Usage: node scripts/run-e2e-local.mjs " +
      "<configured|fixtures|fixtures-prod-reject>",
  );
  process.exit(2);
}

// Resolve + loopback-verify LOCAL Supabase creds (throws before any build/start
// if the target is missing/hosted/deceptive).
const localEnv = resolveLocalSupabaseTestEnv({ E2E_SUITE: suite });

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: localEnv });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(
  `[e2e local] Local Supabase: ${describeSupabaseTarget(
    localEnv.NEXT_PUBLIC_SUPABASE_URL,
  )}`,
);
console.log(`[e2e local] Building against local Supabase…`);
run("npm", ["run", "build"]);

console.log(`[e2e local] Running Playwright suite "${suite}"…`);
run("npx", ["playwright", "test"]);
