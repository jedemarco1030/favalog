import { expect, test } from "@playwright/test";

test.describe("Title detail", () => {
  test("movie detail renders movie-specific information", async ({ page }) => {
    await page.goto("/title/afterglow");

    await expect(
      page.getByRole("heading", { level: 1, name: "Afterglow" }),
    ).toBeVisible();
    // Movie-only detail rows.
    await expect(page.getByText("Director", { exact: true })).toBeVisible();
    await expect(page.getByText("Runtime", { exact: true })).toBeVisible();
    await expect(page.getByText(/Directed by Noor Salim/)).toBeVisible();
  });

  test("book detail renders book-specific information", async ({ page }) => {
    await page.goto("/title/the-small-hours");

    await expect(
      page.getByRole("heading", { level: 1, name: /The Small Hours/ }),
    ).toBeVisible();
    // Book-only detail rows.
    await expect(page.getByText("Author", { exact: true })).toBeVisible();
    await expect(page.getByText("Pages", { exact: true })).toBeVisible();
    await expect(page.getByText(/By Camille Aro/)).toBeVisible();
  });

  test("an invalid slug renders the custom not-found experience", async ({
    page,
  }) => {
    const response = await page.goto("/title/this-slug-does-not-exist");
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
