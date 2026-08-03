import { expect, test } from "@playwright/test";

test.describe("Diary", () => {
  test("loads with its heading and timeline", async ({ page }) => {
    await page.goto("/diary");

    await expect(
      page.getByRole("heading", { level: 1, name: "Diary" }),
    ).toBeVisible();
    // Month group headings prove the resolved timeline rendered.
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  });

  test("media-type filtering narrows the timeline", async ({ page }) => {
    await page.goto("/diary");

    const booksButton = page.getByRole("button", {
      name: "Books",
      exact: true,
    });
    await booksButton.click();
    await expect(booksButton).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/type=book/);
  });

  test("a diary entry links through to its title detail", async ({ page }) => {
    await page.goto("/diary");

    // The title link's accessible name is "<title> (<kind>, <year>)".
    const firstTitleLink = page
      .getByRole("link", { name: /\((Film|Series|Book), \d{4}\)$/ })
      .first();
    await firstTitleLink.click();

    await expect(page).toHaveURL(/\/title\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
