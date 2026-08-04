import { expect, test } from "@playwright/test";

test.describe("Lists", () => {
  test("browse the index, open a list, then open a title from it", async ({
    page,
  }) => {
    await page.goto("/lists");

    await expect(
      page.getByRole("heading", { level: 1, name: "Lists" }),
    ).toBeVisible();

    // Open a known list from the index via its accessible card link.
    await page
      .getByRole("link", { name: /Favorite Sci-Fi — a list by/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/list\/favorite-sci-fi$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Favorite Sci-Fi" }),
    ).toBeVisible();

    // Metadata: creator and the presentation-only actions.
    await expect(page.getByText(/A list by/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Like this list" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share this list" }),
    ).toBeVisible();

    // Open a media title from the list and confirm the detail page loads.
    await page.getByRole("link", { name: /Dune: Part Two \(Film,/ }).click();
    await expect(page).toHaveURL(/\/title\/dune-part-two$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Dune: Part Two/ }),
    ).toBeVisible();
  });

  test("local search narrows the index by title", async ({ page }) => {
    await page.goto("/lists");

    await page.getByRole("searchbox", { name: "Search lists" }).fill("comfort");

    await expect(page.getByText(/Results for/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Comfort Watches — a list by/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Favorite Sci-Fi — a list by/ }),
    ).toHaveCount(0);
  });

  test("an invalid list slug renders the custom not-found experience", async ({
    page,
  }) => {
    const response = await page.goto("/list/this-list-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /couldn.?t find that page/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to Explore" }),
    ).toBeVisible();
  });
});
