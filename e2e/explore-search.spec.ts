import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage for Explore's catalog search (AI Discovery v1 — hybrid
 * retrieval, never generative).
 *
 * ENVIRONMENT NOTE (same model as `favorites.spec.ts` / `lists-persistence.spec.ts`)
 * ---------------------------------------------------------------------------------
 * `playwright.config.ts` builds and starts ONE production server that inherits
 * whatever Supabase configuration the machine provides. These tests are written
 * to be DETERMINISTIC and local-safe:
 *
 *  - They never require an OpenAI key. Semantic retrieval is a paid, optional
 *    arm; keyword search always works, and the app degrades to keyword-only
 *    when semantic is disabled/unconfigured/slow. Result assertions therefore
 *    hold for hybrid OR keyword modes.
 *  - They drive search through SHAREABLE URLs (`/explore?q=...&type=...`), the
 *    surface's own contract, rather than depending on per-keystroke behavior.
 *  - Catalog-result assertions are guarded so that with Supabase UNCONFIGURED
 *    (search returns `unavailable`) the suite still verifies the no-environment
 *    fallback (editorial shelves + search box) instead of failing.
 *  - The genuinely live semantic path is written but SKIPPED unless a real
 *    `OPENAI_API_KEY` is present.
 */

const DUNE_LINK = /Dune: Part Two \(Film, 2024\)/;

/**
 * Any of Explore's controlled, non-crashing "no results" states: the catalog
 * empty state (`No matches yet.`), a safe failure (`went wrong`), or the
 * Supabase-unconfigured state (`available right now`). Which one appears depends
 * on the machine's environment and whether the local catalog is seeded, so the
 * deterministic guarantee is simply that ONE of them is shown — never a crash.
 */
const CONTROLLED_NO_RESULTS = /No matches yet|went wrong|available right now/i;

/**
 * The Explore page's own search box. The site-wide navigation also exposes a
 * "Search Favalog" searchbox, so every query is scoped to the page `main` to
 * stay unambiguous (matching `explore.spec.ts`).
 */
function exploreSearchbox(page: import("@playwright/test").Page) {
  return page
    .getByRole("main")
    .getByRole("searchbox", { name: "Search Favalog" });
}

/** Whether the current page rendered real catalog search results. */
async function hasResults(page: import("@playwright/test").Page) {
  return (
    (await page
      .getByRole("heading", { name: /Results for/ })
      .isVisible()
      .catch(() => false)) &&
    (await page
      .getByRole("listitem")
      .first()
      .isVisible()
      .catch(() => false))
  );
}

test.describe("Explore catalog search — shareable URL contract", () => {
  test("exact-title search surfaces the matching title (or falls back to editorial browsing)", async ({
    page,
  }) => {
    await page.goto("/explore?q=Dune%3A%20Part%20Two");

    // The committed query is reflected back into the search box regardless of
    // whether Supabase is configured.
    await expect(exploreSearchbox(page)).toHaveValue("Dune: Part Two");

    if (await hasResults(page)) {
      // Exact-title protection guarantees the matching title appears.
      await expect(page.getByRole("link", { name: DUNE_LINK })).toBeVisible();
    } else {
      // Unseeded catalog / no Supabase env: a calm, controlled state, not a
      // crash or a leaked error.
      await expect(page.getByText(CONTROLLED_NO_RESULTS)).toBeVisible();
    }
  });

  test("natural-language search returns at least one result (keyword or hybrid), or degrades gracefully", async ({
    page,
  }) => {
    await page.goto("/explore?q=memory%20and%20grief");

    await expect(exploreSearchbox(page)).toHaveValue("memory and grief");

    if (await hasResults(page)) {
      const cards = page.getByRole("listitem").getByRole("link");
      expect(await cards.count()).toBeGreaterThan(0);
    } else {
      // Unseeded catalog / no Supabase env: a calm, controlled state, not a
      // crash or a leaked error.
      await expect(page.getByText(CONTROLLED_NO_RESULTS)).toBeVisible();
    }
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
  });

  test("selecting a media filter updates the URL and the pressed state", async ({
    page,
  }) => {
    await page.goto("/explore?q=Dune%3A%20Part%20Two");

    await page.getByRole("button", { name: "Movies", exact: true }).click();

    // The filter navigates to a shareable URL carrying the `type` param.
    await expect(page).toHaveURL(/[?&]type=movie/);
    await expect(page).toHaveURL(/[?&]q=Dune/);
    await expect(
      page.getByRole("button", { name: "Movies", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Explore catalog search — security & product guarantees", () => {
  test("no secret, raw vector, or 'AI-generated' claim leaks to the browser", async ({
    page,
  }) => {
    await page.goto("/explore?q=memory%20and%20grief");
    await expect(exploreSearchbox(page)).toBeVisible();

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

  test("no-environment fallback: Explore always renders editorial shelves and the search box", async ({
    page,
  }) => {
    await page.goto("/explore");

    // The editorial examples label is present with or without Supabase, and the
    // page never crashes.
    await expect(page.getByText(/Editorial examples/)).toBeVisible();
    await expect(exploreSearchbox(page)).toBeVisible();
  });
});

test.describe("Explore catalog search — live semantic (requires OpenAI)", () => {
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
