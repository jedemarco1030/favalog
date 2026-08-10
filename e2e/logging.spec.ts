import { expect, test } from "@playwright/test";

/**
 * Secret-free coverage for the signed-out title-logging and example-diary
 * behavior. These run against the default (no session) app: no credentials, no
 * Supabase test project, no hosted state. The authenticated log → diary →
 * profile flow lives in a separate, gated integration spec that requires a
 * disposable/local test user.
 */
test.describe("Signed-out logging affordances", () => {
  test("Log / Rate / Review route to the safe sign-in flow", async ({
    page,
  }) => {
    await page.goto("/title/dune-part-two");

    const actions = page.getByRole("group", { name: /Actions for/ });
    // All three primary actions are real links into the sign-in returnTo flow.
    const signInLinks = actions.locator(
      'a[href*="/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two"]',
    );
    await expect(signInLinks).toHaveCount(3);

    // A signed-out visitor is told an account is required before redirecting.
    await expect(
      page.getByText(/free account to log, rate, and review/i),
    ).toBeVisible();

    // No dialog is mounted for a signed-out visitor.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Add to list stays honestly unavailable", async ({ page }) => {
    await page.goto("/title/dune-part-two");
    const addToList = page
      .getByRole("group", { name: /Actions for/ })
      .getByRole("button", { name: "Add to list" });
    await expect(addToList).toBeDisabled();
  });
});

test.describe("Example diary (signed-out)", () => {
  test("is clearly labelled as sample content with a sign-in CTA", async ({
    page,
  }) => {
    await page.goto("/diary");

    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Diary" }),
    ).toBeVisible();
    await expect(main.getByText("Example diary")).toBeVisible();
    // Scope the CTA links to the page body so the header's auth links (which
    // also read "Sign in") don't create a strict-mode ambiguity.
    await expect(
      main.getByRole("link", { name: "create an account" }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "sign in" })).toBeVisible();
  });
});
