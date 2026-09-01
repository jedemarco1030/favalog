import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end coverage for Explore's catalog search (AI Discovery v1 — hybrid
 * retrieval, never generative).
 *
 * The contract is split into two DELIBERATELY separate suites, routed to
 * different servers by tag (see `playwright.config.ts`):
 *
 *  - `@configured` — the STRICT seeded-catalog suite. Runs against the server
 *    with Supabase configured and the local catalog seeded. Real results MUST
 *    appear; there are no conditional/degrading branches, so a configured
 *    regression (unavailable/error/empty/missing data) fails the suite.
 *  - `@no-env` — the EXPLICIT no-environment suite. Runs against the server
 *    whose Supabase variables are blanked. It asserts the intended editorial +
 *    controlled-unavailable fallback, and rejects an arbitrary server error.
 *
 * No OpenAI key is required: keyword retrieval always runs, so the seeded
 * catalog returns deterministic keyword results without the (optional, paid)
 * semantic arm. The genuinely live semantic path is written but SKIPPED unless
 * a real `OPENAI_API_KEY` is present.
 */

/** Seeded titles surfaced by the queries below. */
const DUNE_LINK = /Dune: Part Two \(Film, 2024\)/;
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

test.describe("Explore catalog search — shareable URL contract @configured", () => {
  test("exact-title search surfaces the matching title", async ({ page }) => {
    await page.goto("/explore?q=Dune%3A%20Part%20Two");

    // The committed query is reflected back into the search box.
    await expect(exploreSearchbox(page)).toHaveValue("Dune: Part Two");

    // Exact-title protection guarantees the matching title appears.
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: DUNE_LINK })).toBeVisible();
  });

  test("natural-language keyword search returns the matching title", async ({
    page,
  }) => {
    // All three words appear in Afterglow's seeded synopsis, so keyword-only
    // full-text search deterministically surfaces it — no OpenAI needed.
    await page.goto("/explore?q=composer%20coastal%20town");

    await expect(exploreSearchbox(page)).toHaveValue("composer coastal town");
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: AFTERGLOW_LINK }),
    ).toBeVisible();
  });

  test("shareable URL renders the query + filter state without any interaction", async ({
    page,
  }) => {
    await page.goto("/explore?q=Dune%3A%20Part%20Two&type=movie");

    // The input value and the pressed filter both come straight from the URL.
    await expect(exploreSearchbox(page)).toHaveValue("Dune: Part Two");
    await expect(
      page.getByRole("button", { name: "Movies", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "All", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    // The matching result still renders under the movie filter.
    await expect(page.getByRole("link", { name: DUNE_LINK })).toBeVisible();
  });

  test("selecting a media filter updates the URL and the pressed state", async ({
    page,
  }) => {
    await page.goto("/explore?q=Dune%3A%20Part%20Two");

    await page.getByRole("button", { name: "Movies", exact: true }).click();

    // The filter navigates to a shareable URL carrying both params.
    await expect(page).toHaveURL(/[?&]type=movie/);
    await expect(page).toHaveURL(/[?&]q=Dune/);
    await expect(
      page.getByRole("button", { name: "Movies", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: DUNE_LINK })).toBeVisible();
  });
});

test.describe("Explore catalog search — security & product guarantees @configured", () => {
  test("no secret, raw vector, or 'AI-generated' claim leaks to the browser", async ({
    page,
  }) => {
    await page.goto("/explore?q=composer%20coastal%20town");
    await expect(exploreSearchbox(page)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toBeVisible();

    const content = await page.content();

    // Server-only secrets must never reach the client.
    expect(content).not.toContain("OPENAI_API_KEY");
    expect(content).not.toContain("sb_secret");
    expect(content).not.toContain("service_role");

    // No raw embedding vector (a long "[0.xxx, 0.xxx, ...]" float array).
    expect(content).not.toMatch(
      /\[\s*-?0?\.\d+\s*,\s*-?0?\.\d+\s*,\s*-?0?\.\d+/,
    );

    // Retrieval only — results are never advertised as generated by an AI.
    expect(content).not.toMatch(/AI-generated/i);
  });

  test("Explore renders the real catalog browser and the search box", async ({
    page,
  }) => {
    await page.goto("/explore");

    // With Supabase configured and no active query, the no-query view is the
    // REAL server-backed catalog browser (not the no-env editorial examples).
    await expect(
      page.getByRole("heading", { name: "Browse the catalog" }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort" })).toBeVisible();
    await expect(exploreSearchbox(page)).toBeVisible();
  });
});

test.describe("Explore catalog search — no environment @no-env", () => {
  test("editorial shelves and the search box render without Supabase", async ({
    page,
  }) => {
    await page.goto("/explore");

    // The editorial examples label and the search box are always present, and
    // the page never crashes even with Supabase unconfigured.
    await expect(page.getByText(/Editorial examples/)).toBeVisible();
    await expect(exploreSearchbox(page)).toBeVisible();
  });

  test("search reports the controlled unavailable state, never an error", async ({
    page,
  }) => {
    await page.goto("/explore?q=afterglow");

    // The committed query is still reflected back into the search box.
    await expect(exploreSearchbox(page)).toHaveValue("afterglow");

    // The INTENDED fallback: the calm "search isn't available" state.
    await expect(
      page.getByText(/Search isn.t available right now/),
    ).toBeVisible();

    // An arbitrary server error or a real (seeded) result must NOT appear —
    // the no-env path is a deliberate, controlled fallback only.
    await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toHaveCount(0);
  });
});

test.describe("Explore catalog search — live semantic (requires OpenAI) @configured", () => {
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  test("natural-language query returns semantically relevant results", async ({
    page,
  }) => {
    test.skip(
      !hasOpenAi,
      "Set OPENAI_API_KEY (and populate embeddings) to run the live semantic search path.",
    );

    await page.goto(
      "/explore?q=a%20thoughtful%20sci-fi%20story%20about%20memory%20and%20grief",
    );

    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toBeVisible();
    const cards = page.getByRole("listitem").getByRole("link");
    expect(await cards.count()).toBeGreaterThan(0);
  });
});
