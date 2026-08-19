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
    // All four actions (Log / Rate / Review / Add to list) are real links into
    // the sign-in returnTo flow now that list persistence is wired — the
    // signed-out "Add to list" is a link, never a fake local experience.
    const signInLinks = actions.locator(
      'a[href*="/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two"]',
    );
    await expect(signInLinks).toHaveCount(4);

    // A signed-out visitor is told an account is required before redirecting.
    await expect(
      page.getByText(/free account to log, rate, review/i),
    ).toBeVisible();

    // No dialog is mounted for a signed-out visitor.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("shows a neutral 'Log' primary action, never personalized state", async ({
    page,
  }) => {
    await page.goto("/title/dune-part-two");
    const actions = page.getByRole("group", { name: /Actions for/ });

    // The primary affordance is the honest "Log" — never a "Watched"/"Read"
    // that would imply the app knows a signed-out visitor's viewing state.
    await expect(actions.getByRole("link", { name: "Log" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Watched" })).toHaveCount(0);
    await expect(actions.getByRole("link", { name: "Log again" })).toHaveCount(
      0,
    );
    await expect(page.getByText(/Watched on/)).toHaveCount(0);
  });

  test("the primary Log action navigates to the safe sign-in returnTo", async ({
    page,
  }) => {
    await page.goto("/title/dune-part-two");
    await page
      .getByRole("group", { name: /Actions for/ })
      .getByRole("link", { name: "Log" })
      .click();

    await expect(page).toHaveURL(
      /\/auth\/sign-in\?returnTo=%2Ftitle%2Fdune-part-two$/,
    );
  });

  test("Add to list routes to the safe sign-in flow", async ({ page }) => {
    // List persistence is now wired: for a signed-out visitor "Add to list" is
    // a real link into the same safe sign-in returnTo flow as the other
    // actions (it used to be a disabled "coming soon" button).
    await page.goto("/title/dune-part-two");
    const addToList = page
      .getByRole("group", { name: /Actions for/ })
      .getByRole("link", { name: "Add to list" });
    await expect(addToList).toHaveAttribute(
      "href",
      "/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two",
    );
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
