/**
 * Shared, single-source-of-truth guard that keeps every mutation-capable E2E
 * entry point pinned to a LOCAL Supabase target.
 *
 * WHY THIS EXISTS: this repo's `.env.local` points at a HOSTED Supabase project.
 * The Playwright suites (the fixtures suite AND the ordinary configured/default
 * suite) provision users and write catalog/diary/list/favorite rows. If any of
 * them implicitly picked up the hosted `.env.local`, they would MUTATE
 * PRODUCTION. This module is imported by every write-capable entry point — the
 * local E2E runner (`scripts/run-e2e-local.mjs`), the fixtures admin client
 * (`e2e/fixtures/admin.ts`), the auth setup, and `playwright.config.ts` — so the
 * "must be loopback" decision is defined ONCE, parsed STRUCTURALLY, and reused
 * everywhere. There is deliberately NO override that permits a hosted target.
 *
 * The URL predicates are pure (no I/O) so they can be unit-tested without a
 * running stack; the resolver helpers spawn the local Supabase CLI / read an
 * explicitly-ignored local env file.
 *
 * Server/tooling only — never imported by application or client code.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/**
 * Hostnames that unambiguously denote the local loopback interface. `URL`
 * exposes an IPv6 host in bracketed form (`[::1]`), so both spellings are
 * listed. Anything else — including `0.0.0.0`, private LAN ranges, and every
 * public host — is rejected as non-local.
 * @type {ReadonlySet<string>}
 */
export const LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);

/**
 * Structurally decide whether a value is an unambiguous local loopback Supabase
 * URL. Fails closed for every ambiguous or hostile shape:
 *
 *  - missing / non-string / empty / whitespace-only
 *  - quoted values (a common `.env` mistake that hides the real host)
 *  - malformed URLs the WHATWG parser rejects
 *  - non-HTTP(S) schemes (`ftp:`, `postgres:`, `javascript:`, …)
 *  - user-info-obscured hosts (`http://127.0.0.1@evil.com`, `http://u:p@…`)
 *  - remote / unknown hosts (anything not in {@link LOOPBACK_HOSTS})
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isLoopbackSupabaseUrl(raw) {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (value === "") return false;
  // Reject any wrapping/embedded quote or backtick: a quoted env value would
  // otherwise parse in surprising ways and mask the true host.
  if (/["'`]/.test(value)) return false;

  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  // Only plain HTTP(S). This blocks postgres:, ftp:, file:, javascript:, etc.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // Any embedded credentials mean the visible "host" cannot be trusted; the
  // real host is whatever follows the `@`. Refuse outright.
  if (url.username !== "" || url.password !== "") return false;

  return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Scheme-agnostic loopback check for a Postgres connection URL (`DB_URL`).
 * `supabase status` exposes the local database as a `postgresql://…` URL, which
 * is intentionally NOT accepted by {@link isLoopbackSupabaseUrl} (that guards the
 * HTTP(S) API/REST endpoints). Here only the HOST must be loopback; the postgres
 * scheme and any embedded local role credentials are allowed, because a
 * user-info-obscured host (`postgresql://x@evil.com`) still resolves its real
 * host after the `@`, which the loopback host check rejects.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isLoopbackHostUrl(raw) {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (value === "") return false;
  if (/["'`]/.test(value)) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Throw unless `raw` resolves to a loopback host (any scheme). Used for the
 * Postgres `DB_URL`. Never prints secrets (credentials are redacted).
 * @param {unknown} raw
 * @param {string} [label]
 * @returns {string}
 */
export function assertLoopbackHostUrl(raw, label = "DB URL") {
  if (!isLoopbackHostUrl(raw)) {
    throw new Error(
      `[e2e safety] Refusing to proceed: ${label} does not resolve to a local ` +
        `loopback host (got ${describeSupabaseTarget(raw)}). Mutation-capable ` +
        `E2E must run ONLY against local Supabase (127.0.0.1 / localhost / ::1). ` +
        `There is no override that permits a hosted target.`,
    );
  }
  return String(raw).trim();
}

/**
 * Redact any credentials from a URL-ish value for safe error output. Never
 * throws; returns a short placeholder for non-strings/unparseable input.
 * @param {unknown} raw
 * @returns {string}
 */
export function describeSupabaseTarget(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return "<missing>";
  try {
    const url = new URL(raw.trim());
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${url.hostname}${port}`;
  } catch {
    return "<malformed URL>";
  }
}

/**
 * Throw unless `raw` is an unambiguous local loopback Supabase URL. Used as the
 * hard gate BEFORE creating an admin client, provisioning a user, starting
 * Next.js, or executing tests. Never prints secrets (credentials are redacted).
 *
 * @param {unknown} raw
 * @param {string} [label]
 * @returns {string} the validated, trimmed URL
 */
export function assertLoopbackSupabaseUrl(raw, label = "Supabase URL") {
  if (!isLoopbackSupabaseUrl(raw)) {
    throw new Error(
      `[e2e safety] Refusing to proceed: ${label} is not an unambiguous local ` +
        `loopback target (got ${describeSupabaseTarget(raw)}). ` +
        `Mutation-capable E2E must run ONLY against local Supabase ` +
        `(127.0.0.1 / localhost / ::1). Start it with "npm run supabase:start". ` +
        `There is no override that permits a hosted target.`,
    );
  }
  return String(raw).trim();
}

/**
 * Verify that EVERY supplied Supabase URL independently agrees on a local
 * target. Throws on the first non-loopback entry so a mixed configuration (e.g.
 * a local API URL beside a hosted DB URL) can never slip through.
 *
 * @param {ReadonlyArray<readonly [string, unknown]>} entries `[label, url]` pairs
 */
export function assertAllLoopback(entries) {
  for (const [label, url] of entries) {
    assertLoopbackSupabaseUrl(url, label);
  }
}

/**
 * When a Supabase URL is present in the environment it MUST be loopback; when it
 * is entirely absent (the intentional no-env / unconfigured build), nothing is
 * asserted because no client — and therefore no write — can be created. Both
 * the public and server URLs are checked. Used by `playwright.config.ts` as the
 * "before executing tests" gate and is safe in CI, where the default suite runs
 * against an unconfigured build with no Supabase URL at all.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function assertConfiguredSupabaseIsLocal(env = process.env) {
  /** @type {ReadonlyArray<readonly [string, string | undefined]>} */
  const candidates = [
    ["NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL],
    ["SUPABASE_URL", env.SUPABASE_URL],
  ];
  for (const [label, value] of candidates) {
    if (value !== undefined && value.trim() !== "") {
      assertLoopbackSupabaseUrl(value, label);
    }
  }
}

/**
 * Parse `KEY="value"` / `KEY=value` lines into a plain object. Shared by the
 * `supabase status` reader and the local env-file fallback.
 * @param {string} raw
 * @returns {Record<string, string>}
 */
function parseEnvLines(raw) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    // Strip a single layer of matching surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

/** Read `supabase status -o env` from the running local stack, or null. */
function tryReadSupabaseStatus() {
  const attempts = [
    ["supabase", ["status", "-o", "env"]],
    ["node_modules/.bin/supabase", ["status", "-o", "env"]],
  ];
  for (const [cmd, args] of attempts) {
    try {
      const raw = execFileSync(cmd, args, { encoding: "utf8" });
      const env = parseEnvLines(raw);
      if (env.API_URL) return env;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/**
 * Read an explicitly-ignored local E2E env file (default `.env.e2e.local`), or
 * null if it is absent. This is the documented alternative to a running stack.
 * @param {string} [path]
 */
function tryReadEnvFile(path = ".env.e2e.local") {
  if (!existsSync(path)) return null;
  const env = parseEnvLines(readFileSync(path, "utf8"));
  // Normalise the two spellings the file might use.
  if (!env.API_URL && env.SUPABASE_URL) env.API_URL = env.SUPABASE_URL;
  if (!env.API_URL && env.NEXT_PUBLIC_SUPABASE_URL) {
    env.API_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  }
  return env.API_URL ? env : null;
}

/**
 * Resolve LOCAL Supabase credentials for the mutation-capable E2E suites from
 * the running local stack (`supabase status`) or, failing that, an explicitly
 * ignored local env file. Throws if neither is available, and — before
 * returning — HARD-VERIFIES that every relevant Supabase URL is loopback so a
 * hosted target can never be produced here.
 *
 * @returns {{
 *   apiUrl: string,
 *   dbUrl: string,
 *   restUrl: string,
 *   anonKey: string,
 *   publishableKey: string,
 *   secretKey: string,
 *   serviceRoleKey: string,
 * }}
 */
export function readLocalSupabaseEnv() {
  const local = tryReadSupabaseStatus() ?? tryReadEnvFile();
  if (!local) {
    throw new Error(
      "[e2e safety] Could not resolve LOCAL Supabase credentials. Start the " +
        'local stack ("npm run supabase:start") or create an explicitly ' +
        "ignored .env.e2e.local with the local values. This runner never reads " +
        ".env.local (which points at hosted Supabase).",
    );
  }

  const apiUrl = local.API_URL ?? "";
  const dbUrl = local.DB_URL ?? "";
  const restUrl = local.REST_URL ?? "";

  // Every present URL must independently agree on a local target, checked
  // BEFORE any client/build/start uses them. The HTTP(S) API/REST endpoints use
  // the strict http(s)-only predicate; the Postgres DB URL (scheme
  // `postgresql://`, possibly with local role credentials) is checked host-only.
  assertLoopbackSupabaseUrl(apiUrl, "API_URL");
  if (restUrl) assertLoopbackSupabaseUrl(restUrl, "REST_URL");
  if (dbUrl) assertLoopbackHostUrl(dbUrl, "DB_URL");

  return {
    apiUrl,
    dbUrl,
    restUrl,
    anonKey: local.ANON_KEY ?? "",
    publishableKey: local.PUBLISHABLE_KEY ?? local.ANON_KEY ?? "",
    secretKey: local.SECRET_KEY ?? local.SERVICE_ROLE_KEY ?? "",
    serviceRoleKey: local.SERVICE_ROLE_KEY ?? local.SECRET_KEY ?? "",
  };
}

/**
 * Build the environment object injected into `next build` / `next start` and the
 * Playwright runner for a mutation-capable suite. A pre-set `process.env` value
 * wins over Next's `.env.local`, so injecting these LOCAL values here fully
 * neutralises the hosted `.env.local` for both the build (where `NEXT_PUBLIC_*`
 * is inlined) and the run.
 *
 * @param {Record<string, string>} [extra] additional env to merge on top
 * @returns {Record<string, string | undefined>}
 */
export function resolveLocalSupabaseTestEnv(extra = {}) {
  const local = readLocalSupabaseEnv();
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.anonKey,
    SUPABASE_URL: local.apiUrl,
    SUPABASE_SECRET_KEY: local.secretKey,
    SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
    // No compatible embedding corpus locally; keep search keyword-only so no
    // OpenAI/network call is made during E2E.
    SEMANTIC_SEARCH_ENABLED: "false",
    ...extra,
  };
}
