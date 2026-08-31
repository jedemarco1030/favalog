import { expect, test as setup } from "@playwright/test";

import { ensureFixtureUser, FIXTURE_USER } from "./admin";

/**
 * Playwright "setup project" that provisions a confirmed, onboarded user in
 * local Supabase and signs in through the REAL sign-in UI so the SSR cookie
 * session is established the same way a person's is. The resulting storage
 * state is reused by the authenticated `@fixtures` specs.
 */

const STORAGE_STATE = "e2e/.auth/fixtures-user.json";

setup("provision + sign in fixture user", async ({ page }) => {
  await ensureFixtureUser();

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(FIXTURE_USER.email);
  await page.getByLabel("Password").fill(FIXTURE_USER.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // A successful sign-in redirects away from the auth area.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 30_000,
  });

  // Sanity: the account-required "Sign in" affordance is gone once signed in.
  await expect(page.getByRole("link", { name: /^sign in$/i })).toHaveCount(0);

  await page.context().storageState({ path: STORAGE_STATE });
});
