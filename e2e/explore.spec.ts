import { expect, test } from "@playwright/test";

test.describe("Explore discovery", () => {
  test("search returns the expected media item", async ({ page }) => {
    await page.goto("/explore");

    await page
      .getByRole("main")
      .getByRole("searchbox", { name: "Search Favalog" })
      .fill("afterglow");

    await expect(page.getByText(/Results for/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Afterglow \(Film, 2023\)/ }),
    ).toBeVisible();
  });

  test("media-type filtering narrows results to one kind", async ({ page }) => {
    await page.goto("/explore");

    await page.getByRole("button", { name: "Movies", exact: true }).click();

    // A movie stays visible; a book is filtered out entirely.
    await expect(
      page.getByRole("link", { name: /Afterglow \(Film, 2023\)/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /\(Book, / })).toHaveCount(0);
  });

  test("navigates from Explore search result to the title detail", async ({
    page,
  }) => {
    await page.goto("/explore");

    await page
      .getByRole("main")
      .getByRole("searchbox", { name: "Search Favalog" })
      .fill("afterglow");

    // Explore debounces a `router.replace(?q=…)` after each keystroke. Wait
    // for that URL sync to settle before clicking so the in-flight replace
    // cannot race with (and cancel) the navigation to the title page.
    await expect(page).toHaveURL(/[?&]q=afterglow/);

    await page.getByRole("link", { name: /Afterglow \(Film, 2023\)/ }).click();

    await expect(page).toHaveURL(/\/title\/afterglow$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Afterglow" }),
    ).toBeVisible();
  });
});
