import { expect, test } from "@playwright/test";

test.describe("Home and navigation", () => {
  test("homepage renders with its hero and primary navigation", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Everything you watch and\s*read\./i,
      }),
    ).toBeVisible();

    // The header exposes the primary navigation landmark.
    const primaryNav = page.getByRole("banner").getByRole("navigation", {
      name: "Primary",
    });
    await expect(
      primaryNav.getByRole("link", { name: "Explore" }),
    ).toBeVisible();
  });

  test("navigates from Home to Explore", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("banner")
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Explore" })
      .click();

    await expect(page).toHaveURL(/\/explore$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Explore" }),
    ).toBeVisible();
  });
});
