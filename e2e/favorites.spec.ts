import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage for the persistent favorites loop.
 *
 * ENVIRONMENT NOTE (same model as `lists-persistence.spec.ts`)
 * -----------------------------------------------------------
 * `playwright.config.ts` builds and starts the production app and runs against
 * that single server, which inherits whatever Supabase configuration the
 * machine provides. This suite never deletes/fabricates `.env.local` and never
 * invents Supabase credentials, so it splits into:
 *
 *  - ACTIVE (secret-free): the signed-out Favorite affordance routes through
 *    the safe sign-in `returnTo` flow and never shows a personalized state.
 *
 *  - AUTHENTICATED (env-gated): the real favorite → refresh → profile → remove
 *    loop, gated on `E2E_SUPABASE_TEST_EMAIL` / `E2E_SUPABASE_TEST_PASSWORD`
 *    (a confirmed, onboarded disposable account). It performs a GENUINE
 *    sign-in and real writes when those are set, and skips cleanly otherwise —
 *    never substituting a mocked or faked flow.
 */

test.describe("Favorites — signed-out affordance (secret-free)", () => {
  test("signed-out 'Favorite' links to the safe sign-in returnTo and shows no personalized state", async ({
    page,
  }) => {
    await page.goto("/title/dune-part-two");

    const actions = page.getByRole("group", { name: /Actions for/ });
    const favorite = actions.getByRole("link", { name: "Favorite" });

    // Neutral: a same-origin relative sign-in target back to this title, and
    // never a personalized "Favorited" state for an anonymous visitor.
    await expect(favorite).toHaveAttribute(
      "href",
      "/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two",
    );
    await expect(
      actions.getByRole("button", { name: /from your favorites/i }),
    ).toHaveCount(0);

    await favorite.click();
    await expect(page).toHaveURL(
      /\/auth\/sign-in\?returnTo=%2Ftitle%2Fdune-part-two$/,
    );
  });
});

test.describe("Favorites — authenticated loop (requires Supabase)", () => {
  const testEmail = process.env.E2E_SUPABASE_TEST_EMAIL;
  const testPassword = process.env.E2E_SUPABASE_TEST_PASSWORD;
  const TITLE_PATH = "/title/dune-part-two";

  test("favorite → refresh retains → appears on profile → remove → refresh retains removal → gone from profile", async ({
    page,
  }) => {
    test.skip(
      !testEmail || !testPassword,
      "Set E2E_SUPABASE_TEST_EMAIL and E2E_SUPABASE_TEST_PASSWORD (a confirmed, onboarded disposable Supabase test account) to run the authenticated favorites loop.",
    );

    // 1. Sign in via the real SSR-cookie auth flow.
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(testEmail!);
    await page.getByLabel("Password").fill(testPassword!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
    await expect(page).not.toHaveURL(/\/onboarding/);

    const actions = page.getByRole("group", { name: /Actions for/ });
    const addFavorite = actions.getByRole("button", {
      name: /add .* to your favorites/i,
    });
    const removeFavorite = actions.getByRole("button", {
      name: /remove .* from your favorites/i,
    });

    // Ensure a clean starting point (the account may already have favorited it
    // from a previous run): if it's currently favorited, remove it first.
    await page.goto(TITLE_PATH);
    if (await removeFavorite.isVisible().catch(() => false)) {
      await removeFavorite.click();
      await expect(addFavorite).toBeVisible();
    }

    // 2. Favorite the title; the toggle flips to the pressed "Favorited" state.
    await expect(addFavorite).toHaveAttribute("aria-pressed", "false");
    await addFavorite.click();
    await expect(removeFavorite).toBeVisible();
    await expect(removeFavorite).toHaveAttribute("aria-pressed", "true");

    // 3. Refresh retains the Favorited state (persisted, not optimistic).
    await page.reload();
    await expect(removeFavorite).toHaveAttribute("aria-pressed", "true");

    // 4. It appears on the owner's real profile favorites.
    const profileLink = page.locator('a[href^="/profile/"]').first();
    await profileLink.click();
    await expect(page).toHaveURL(/\/profile\//);
    await expect(page.locator(`a[href="${TITLE_PATH}"]`).first()).toBeVisible();

    // 5. Remove the favorite from the title page.
    await page.goto(TITLE_PATH);
    await expect(removeFavorite).toBeVisible();
    await removeFavorite.click();
    await expect(addFavorite).toBeVisible();
    await expect(addFavorite).toHaveAttribute("aria-pressed", "false");

    // 6. Refresh retains the removal.
    await page.reload();
    await expect(addFavorite).toHaveAttribute("aria-pressed", "false");

    // 7. The profile no longer lists it.
    const profileLinkAgain = page.locator('a[href^="/profile/"]').first();
    await profileLinkAgain.click();
    await expect(page).toHaveURL(/\/profile\//);
    await expect(page.locator(`a[href="${TITLE_PATH}"]`)).toHaveCount(0);
  });
});
