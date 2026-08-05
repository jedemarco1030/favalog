import { expect, test } from "@playwright/test";

/**
 * Secret-free / public auth E2E.
 *
 * These run in ordinary CI with NO Supabase credentials. They verify that the
 * session-aware shell and the auth routes render and are accessible, and that
 * the missing-config state is controlled — never a crash or a raw error. The
 * Supabase-enabled flows (real sign-up/sign-in/onboarding) live in a separate,
 * gated spec that requires a disposable test project.
 */

test.describe("Auth (public, secret-free)", () => {
  test("the signed-out shell exposes sign in / create account", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(
      banner.getByRole("link", { name: /Start your Favalog|Sign up/ }),
    ).toBeVisible();
  });

  test("the sign-in page renders an accessible form", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    // Cross-links among auth routes.
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot your password?" }),
    ).toBeVisible();
  });

  test("the sign-up page renders an accessible form", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await expect(
      page.getByRole("heading", { level: 1, name: "Start your Favalog" }),
    ).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("the forgot-password page renders", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(
      page.getByRole("heading", { level: 1, name: "Reset your password" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("presents a controlled state regardless of auth configuration", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in");
    // Robust to both deployments: with Supabase configured the accessible form
    // is shown; with no env it shows a calm "unavailable" status. Either way
    // the page never crashes or leaks raw configuration/error detail.
    const unavailable = page.getByText(/Accounts aren.?t available/i);
    const emailField = page.getByLabel("Email");
    await expect(unavailable.or(emailField).first()).toBeVisible();
  });

  test("the onboarding route is not publicly reachable", async ({ page }) => {
    // With no auth configured, onboarding redirects to the public home page
    // (and, when configured, to sign-in) — never renders for an anon visitor.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/(auth\/sign-in.*)?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Set up your profile" }),
    ).toHaveCount(0);
  });

  test("public browsing works while signed out", async ({ page }) => {
    await page.goto("/explore");
    await expect(
      page.getByRole("heading", { level: 1, name: "Explore" }),
    ).toBeVisible();
  });
});
