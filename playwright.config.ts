import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

/**
 * Playwright configuration for Favalog end-to-end tests.
 *
 * E2E runs against a production build (`next build` + `next start`) so the
 * tests exercise the same output users get. Locally the `webServer` builds
 * then starts the app; in CI the build is a prior job step and we only start
 * the server here. Chromium is the single default browser to keep CI fast;
 * additional browsers can be added as projects if the need arises.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI ? "npm run start" : "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
