import { expect, test } from "@playwright/test";

test.describe("Profile", () => {
  test("open Jamie's profile from the app shell and explore it", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Open the profile from the application-shell avatar control.
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Your profile" })
      .click();
    await expect(page).toHaveURL(/\/profile\/jamie$/);

    // 2. Verify identity and derived statistics.
    await expect(
      page.getByRole("heading", { level: 1, name: "Jamie DeMarco" }),
    ).toBeVisible();
    // The profile hero is the one <header> that owns the page's single h1.
    const hero = page.locator("header", {
      has: page.getByRole("heading", { level: 1 }),
    });
    await expect(hero.getByText("@jamie")).toBeVisible();

    const stats = page.getByRole("region", { name: "Jamie's statistics" });
    await expect(stats.getByText("Movies watched")).toBeVisible();
    await expect(stats.getByText("Books read")).toBeVisible();
    await expect(stats.getByText("Average rating")).toBeVisible();
    // The average rating is derived from the diary (4.2), not hardcoded.
    await expect(stats.getByText("4.2")).toBeVisible();

    // 3. Open a favorite title from the Favorites shelf.
    const favorites = page.locator("section", {
      has: page.getByRole("heading", { name: "Favorites" }),
    });
    await favorites.getByRole("link", { name: /Dune: Part Two/ }).click();
    await expect(page).toHaveURL(/\/title\//);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dune: Part Two" }),
    ).toBeVisible();

    // 4. Return to the profile.
    await page.goBack();
    await expect(
      page.getByRole("heading", { level: 1, name: "Jamie DeMarco" }),
    ).toBeVisible();

    // 5. Open one of Jamie's lists.
    const lists = page.locator("section", {
      has: page.getByRole("heading", { name: "Lists", exact: true }),
    });
    // Target a list card (its accessible name credits the creator), not the
    // section's "Browse all lists" link.
    await lists
      .getByRole("link", { name: /a list by Jamie DeMarco/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/list\//);
  });

  test("an unknown username renders the custom not-found experience", async ({
    page,
  }) => {
    const response = await page.goto("/profile/no-such-person");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /couldn.?t find that page/i,
      }),
    ).toBeVisible();
  });
});
