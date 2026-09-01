import { defineConfig, devices } from "@playwright/test";

import { assertConfiguredSupabaseIsLocal } from "./scripts/lib/local-supabase-target.mjs";

/**
 * Playwright configuration for Favalog end-to-end tests.
 *
 * E2E runs against a production build (`next build` + `next start`) so the tests
 * exercise the same output users get.
 *
 * IMPORTANT — why this config branches on a build, not just a runtime env:
 * Next inlines `NEXT_PUBLIC_*` variables into the built output at BUILD time.
 * `isSupabaseConfigured()` (`lib/supabase/env.ts`) reads
 * `process.env.NEXT_PUBLIC_SUPABASE_URL` / `..._PUBLISHABLE_KEY`, whose values
 * are therefore frozen when `next build` ran. Blanking those variables only when
 * `next start` runs CANNOT un-configure a build that was produced WITH Supabase
 * configured. The two suites must run against two DIFFERENT builds:
 *
 *  - The CONFIGURED build is produced with Supabase configured. The `default`
 *    project (all existing specs) and the strict `configured` project (the
 *    seeded-catalog Explore contract) run against it.
 *  - The NO-ENV build is produced with the public Supabase variables BLANKED at
 *    build time, so `isSupabaseConfigured()` is false and the app takes its
 *    intentional editorial/unavailable fallback. The `no-env` project runs
 *    against it.
 *
 * Selection is via `E2E_SUITE`:
 *
 *  - `E2E_SUITE=no-env`  -> only the `no-env` project + a single server on port
 *    3100. The caller must have produced a build with the Supabase vars blanked
 *    (see the `test:e2e:no-env` npm script).
 *  - otherwise           -> the `default` + `configured` projects + a single
 *    server on port 3000, against a normally configured build.
 *
 * Specs are routed to a project by a tag in their `describe` title
 * (`@configured` / `@no-env` / `@fixtures` / `@prodreject`); everything untagged
 * is the `default` project. Tagged specs are excluded from `default` so the
 * fixture-backed suites only ever run in their dedicated servers.
 */

const CONFIGURED_PORT = 3000;
const NO_ENV_PORT = 3100;
const FIXTURES_PORT = 3200;
const FIXTURES_PROD_PORT = 3300;
const FIXTURE_SERVER_PORT = 5599;
const configuredBaseURL = `http://localhost:${CONFIGURED_PORT}`;
const noEnvBaseURL = `http://localhost:${NO_ENV_PORT}`;
const fixturesBaseURL = `http://localhost:${FIXTURES_PORT}`;
const fixturesProdBaseURL = `http://localhost:${FIXTURES_PROD_PORT}`;
const isCI = !!process.env.CI;
const suite = process.env.E2E_SUITE;
const isNoEnvSuite = suite === "no-env";
const isFixturesSuite = suite === "fixtures";
const isFixturesProdRejectSuite = suite === "fixtures-prod-reject";

// The fixture-backed suites drive the REAL provider adapters against a local
// fixture HTTP server via the loopback-guarded transport seam, and provision an
// authenticated user through LOCAL Supabase.
//
// IMPORTANT: we deliberately do NOT load `.env.local` here — in this repo it
// points at a HOSTED Supabase project, and the mutation-capable suites write
// data. LOCAL Supabase credentials are injected into the environment by
// `scripts/run-e2e-local.mjs` (loopback-verified). Run these suites ONLY via
// `npm run test:e2e:configured` / `npm run test:e2e:fixtures` /
// `npm run test:e2e:fixtures:prod-reject`. If the local creds are missing, the
// admin helper and the app fail closed rather than touching hosted.
//
// BEFORE-TESTS GATE: for every suite except the credential-free `no-env` one,
// refuse to configure Playwright (and therefore to start Next.js or execute
// tests) if a Supabase URL is present but is not an unambiguous local loopback
// target. When run through `scripts/run-e2e-local.mjs` the injected values are
// local and this passes; a stray hosted `.env.local` value in the environment
// is rejected here, before any server starts. An entirely absent Supabase URL
// (the intentional unconfigured/no-env build, incl. CI's `default` project) is
// allowed because no client — and therefore no write — can be created.
if (!isNoEnvSuite) {
  assertConfiguredSupabaseIsLocal(process.env);
}

/** Storage state produced by the fixtures auth-setup project. */
const FIXTURES_STORAGE_STATE = "e2e/.auth/fixtures-user.json";

/** Server-only env that turns on federation + the loopback transport override. */
const fixtureTransportEnv: Record<string, string> = {
  EXTERNAL_CATALOG_ENABLED: "true",
  TMDB_ENABLED: "true",
  OPEN_LIBRARY_ENABLED: "true",
  // Any non-blank token/contact "configures" the providers; the real network is
  // never reached because the transport seam redirects to the fixture server.
  TMDB_API_READ_TOKEN: process.env.TMDB_API_READ_TOKEN || "fixture-tmdb-token",
  OPEN_LIBRARY_CONTACT_EMAIL:
    process.env.OPEN_LIBRARY_CONTACT_EMAIL || "e2e@example.com",
  CATALOG_TEST_TRANSPORT: "1",
  CATALOG_TEST_TMDB_BASE_URL: `http://127.0.0.1:${FIXTURE_SERVER_PORT}/tmdb`,
  CATALOG_TEST_OPENLIBRARY_BASE_URL: `http://127.0.0.1:${FIXTURE_SERVER_PORT}/ol`,
};

/** The local fixture provider server, shared by both fixture suites. */
const fixtureServer = {
  command: `node e2e/fixtures/provider-fixture-server.mjs`,
  url: `http://127.0.0.1:${FIXTURE_SERVER_PORT}/tmdb/search/tv`,
  reuseExistingServer: !isCI,
  timeout: 30_000,
  env: { FIXTURE_PORT: String(FIXTURE_SERVER_PORT) },
};

const fixturesProjects = [
  {
    // Provisions a confirmed, onboarded user in local Supabase and saves the
    // SSR cookie session for the authenticated fixtures specs.
    name: "fixtures-setup",
    testMatch: /fixtures\/auth\.setup\.ts/,
    use: { ...devices["Desktop Chrome"], baseURL: fixturesBaseURL },
  },
  {
    name: "fixtures",
    grep: /@fixtures\b/,
    dependencies: ["fixtures-setup"],
    use: {
      ...devices["Desktop Chrome"],
      baseURL: fixturesBaseURL,
      storageState: FIXTURES_STORAGE_STATE,
    },
  },
];

const fixturesProdRejectProjects = [
  {
    // Production runtime (VERCEL_ENV=production) MUST reject the transport
    // override; runs signed-out (no auth needed to prove the fixture data is
    // absent because the fixture server was never used).
    name: "fixtures-prod-reject",
    grep: /@prodreject\b/,
    use: { ...devices["Desktop Chrome"], baseURL: fixturesProdBaseURL },
  },
];

const configuredProjects = [
  {
    // Every existing spec (auth, diary, lists, favorites, …). These are
    // written to be local-safe and run against the configured server.
    name: "default",
    grepInvert: /@configured|@no-env|@fixtures|@prodreject/,
    use: { ...devices["Desktop Chrome"], baseURL: configuredBaseURL },
  },
  {
    // The STRICT seeded-catalog Explore contract. Requires Supabase to be
    // configured and the local catalog seeded; it fails (never degrades) on an
    // unavailable/error/empty state or missing catalog data.
    name: "configured",
    grep: /@configured/,
    use: { ...devices["Desktop Chrome"], baseURL: configuredBaseURL },
  },
];

const noEnvProjects = [
  {
    // The EXPLICIT no-environment Explore contract, run against a build whose
    // public Supabase variables were blanked at BUILD time.
    name: "no-env",
    grep: /@no-env/,
    use: { ...devices["Desktop Chrome"], baseURL: noEnvBaseURL },
  },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "on-first-retry",
  },
  projects: isNoEnvSuite
    ? noEnvProjects
    : isFixturesSuite
      ? fixturesProjects
      : isFixturesProdRejectSuite
        ? fixturesProdRejectProjects
        : configuredProjects,
  webServer: isNoEnvSuite
    ? {
        // The no-env build must already exist (produced with the public Supabase
        // vars blanked). This only starts it — it never builds.
        command: `npm run start -- --port ${NO_ENV_PORT}`,
        url: noEnvBaseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      }
    : isFixturesSuite
      ? [
          fixtureServer,
          {
            // Reuse the configured build; federation + the loopback transport are
            // runtime, server-only env, so no rebuild is needed.
            command: `npm run start -- --port ${FIXTURES_PORT}`,
            url: fixturesBaseURL,
            reuseExistingServer: !isCI,
            timeout: 120_000,
            env: fixtureTransportEnv,
          },
        ]
      : isFixturesProdRejectSuite
        ? [
            fixtureServer,
            {
              // Same build + transport env, but a PRODUCTION runtime marker. The
              // transport override must be refused, so the fixture server is
              // never used. A fake token keeps the (now real-host) provider call
              // offline/failing rather than using any real secret.
              command: `npm run start -- --port ${FIXTURES_PROD_PORT}`,
              url: fixturesProdBaseURL,
              reuseExistingServer: !isCI,
              timeout: 120_000,
              env: {
                ...fixtureTransportEnv,
                VERCEL_ENV: "production",
                TMDB_API_READ_TOKEN: "fixture-prod-reject-token",
                OPEN_LIBRARY_CONTACT_EMAIL: "prod-reject@example.com",
              },
            },
          ]
        : {
            command: `npm run start -- --port ${CONFIGURED_PORT}`,
            url: configuredBaseURL,
            reuseExistingServer: !isCI,
            timeout: 120_000,
          },
});
