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

  test("signed-out 'Add to list' links to the safe sign-in returnTo", async ({
    page,
  }) => {
    // Persistent lists are wired now, so "Add to list" is a real affordance.
    // In this environment there is no Supabase session (no `.env.local`), so
    // the viewer is signed out and the control renders as a LINK into the same
    // safe sign-in `returnTo` flow as Log/Rate/Review — never a fake local
    // "added to list" experience. (If this suite were ever run with a default
    // authenticated session it would instead be an in-page button that opens
    // the Add-to-list dialog; we inspect the link's href below rather than
    // relying only on a click so the intent stays clear either way.)
    await page.goto("/title/dune-part-two");

    const actions = page.getByRole("group", { name: /Actions for/ });
    const addToList = actions.getByRole("link", { name: "Add to list" });

    // Same-origin relative target, URL-encoded, pointing back to this title.
    await expect(addToList).toHaveAttribute(
      "href",
      "/auth/sign-in?returnTo=%2Ftitle%2Fdune-part-two",
    );

    await addToList.click();
    await expect(page).toHaveURL(
      /\/auth\/sign-in\?returnTo=%2Ftitle%2Fdune-part-two$/,
    );
  });
});
