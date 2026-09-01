import { expect, test, type Page } from "@playwright/test";

/**
 * Explore discovery — STRICT seeded-catalog contract (`@configured`).
 *
 * These tests run ONLY in the `configured` Playwright project, against the
 * server that has Supabase configured and the local catalog seeded (see
 * `playwright.config.ts`). They are deliberately UNCONDITIONAL: real catalog
 * results MUST appear, so the suite fails for real on an `unavailable`/error/
 * empty state or missing catalog data instead of silently accepting a
 * degraded fallback.
 *
 * No OpenAI key is required: keyword retrieval always runs and the seeded
 * catalog returns keyword results, so every assertion here is deterministic
 * without the (optional, paid) semantic arm.
 */

/** The seeded movie surfaced by the queries below. */
const AFTERGLOW_LINK = /Afterglow \(Film, 2023\)/;

/**
 * The Explore page's own search box. The site-wide navigation also exposes a
 * "Search Favalog" searchbox, so every query is scoped to the page `main`.
 */
function exploreSearchbox(page: Page) {
  return page
    .getByRole("main")
    .getByRole("searchbox", { name: "Search Favalog" });
}

test.describe("Explore discovery @configured", () => {
  test("submitting a search surfaces the matching catalog title", async ({
    page,
  }) => {
    await page.goto("/explore");

    // Typing alone never searches; an explicit submit navigates to `?q=`.
    await exploreSearchbox(page).fill("afterglow");
    await exploreSearchbox(page).press("Enter");

    await expect(page).toHaveURL(/[?&]q=afterglow/);
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: AFTERGLOW_LINK }),
    ).toBeVisible();
  });

  test("typing never searches; only an explicit submit navigates and renders results", async ({
    page,
  }) => {
    await page.goto("/explore");

    // Before any committed query the real server-backed catalog browser is
    // shown (Supabase configured), not a search results heading.
    await expect(
      page.getByRole("heading", { name: "Browse the catalog" }),
    ).toBeVisible();

    // Typing updates the input but must NOT navigate or run a search.
    await exploreSearchbox(page).fill("afterglow");
    await expect(page).toHaveURL(/\/explore$/);
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toHaveCount(0);

    // Submitting commits the query to a shareable URL and renders results.
    await exploreSearchbox(page).press("Enter");
    await expect(page).toHaveURL(/[?&]q=afterglow/);
    await expect(
      page.getByRole("link", { name: AFTERGLOW_LINK }),
    ).toBeVisible();
  });

  test("media-type filtering narrows results to a single kind", async ({
    page,
  }) => {
    // A shareable query URL renders results without interaction.
    await page.goto("/explore?q=afterglow");
    await expect(
      page.getByRole("link", { name: AFTERGLOW_LINK }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Movies", exact: true }).click();

    // The filter navigates to a shareable URL and reflects the pressed state.
    await expect(page).toHaveURL(/[?&]type=movie/);
    await expect(
      page.getByRole("button", { name: "Movies", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // A movie stays visible; a book is filtered out of the results entirely.
    await expect(
      page.getByRole("link", { name: AFTERGLOW_LINK }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").getByRole("link", { name: /\(Book, / }),
    ).toHaveCount(0);
  });

  test("navigates from an Explore search result to the title detail", async ({
    page,
  }) => {
    await page.goto("/explore?q=afterglow");

    await page.getByRole("link", { name: AFTERGLOW_LINK }).click();

    await expect(page).toHaveURL(/\/title\/afterglow$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Afterglow" }),
    ).toBeVisible();
  });
});
