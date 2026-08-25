import { defineConfig, devices } from "@playwright/test";

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
 * (`@configured` / `@no-env`); everything untagged is the `default` project.
 */

const CONFIGURED_PORT = 3000;
const NO_ENV_PORT = 3100;
const configuredBaseURL = `http://localhost:${CONFIGURED_PORT}`;
const noEnvBaseURL = `http://localhost:${NO_ENV_PORT}`;
const isCI = !!process.env.CI;
const isNoEnvSuite = process.env.E2E_SUITE === "no-env";

const configuredProjects = [
  {
    // Every existing spec (auth, diary, lists, favorites, …). These are
    // written to be local-safe and run against the configured server.
    name: "default",
    grepInvert: /@configured|@no-env/,
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
  projects: isNoEnvSuite ? noEnvProjects : configuredProjects,
  webServer: isNoEnvSuite
    ? {
        // The no-env build must already exist (produced with the public Supabase
        // vars blanked). This only starts it — it never builds.
        command: `npm run start -- --port ${NO_ENV_PORT}`,
        url: noEnvBaseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      }
    : {
        command: `npm run start -- --port ${CONFIGURED_PORT}`,
        url: configuredBaseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
