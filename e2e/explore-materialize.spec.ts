import { expect, test } from "@playwright/test";

import { countMediaByExternalId, countMediaBySlug } from "./fixtures/admin";

/**
 * Deterministic runtime coverage of Catalog Platform v1B — federated Explore +
 * on-demand materialization (Catalog Platform v1B).
 *
 * These specs run in the `fixtures` project: the REAL provider adapters are
 * routed to a LOCAL fixture HTTP server through the loopback-guarded transport
 * seam, an authenticated + onboarded user is provisioned in local Supabase, and
 * the app exercises the same production Server Action, canonical RPC, redirect,
 * and title-page code paths. No provider secrets, no external network, no hosted
 * Supabase.
 *
 * Fixture query tokens (see e2e/fixtures/provider-fixture-server.mjs):
 *   - "dune":    TMDB returns Dune: Part Two (693134, same work as the seeded
 *                curated `dune-part-two`); Open Library FAILS (one provider down).
 *   - "voyager": TMDB returns a brand-new importable movie (movie:999001).
 *   - "sandworm": Open Library returns an importable book whose Work record
 *                OMITS first_publish_date; the year is only recoverable via the
 *                adapter's exact Work-key Search fallback (real Dune shape).
 *
 * Assertions are DEFINITE — never "accept success OR failure". The suite is
 * serial because the scenarios share catalog state (import once, then re-resolve).
 */

const VOYAGER_TITLE = "Fixture Voyager Chronicles";
const VOYAGER_EXTERNAL_ID = "movie:999001";
const DUNE_SLUG = "dune-part-two";

// The dateless-Work book: its Open Library Work record OMITS first_publish_date,
// so its year (1965) is only recoverable via the adapter's bounded exact
// Work-key Search fallback. Materializing it at all proves the fallback year
// passed validation (a year-0 record would be rejected before any write).
const SANDWORM_TITLE = "Fixture Sandworm Saga";
const SANDWORM_EXTERNAL_ID = "OL9300001W";

// Captured after the new title is materialized, reused by later scenarios.
let voyagerSlug = "";
let sandwormSlug = "";

test.describe.serial("@fixtures federated Explore + materialization", () => {
  test("local results survive when one provider fails", async ({ page }) => {
    await page.goto("/explore?q=dune");

    // Local hybrid results still render.
    await expect(
      page.getByRole("heading", { name: /Results for/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Dune: Part Two \(Film, 2024\)/ }),
    ).toBeVisible();

    // The failed provider (Open Library) is isolated to a controlled note and
    // never hides the rest of the page. This section STREAMS in after the
    // provider fails, so allow more time than the default. Matched on the
    // apostrophe-free prefix, which is unique to the failure note. (The TMDB
    // arm's only hit for "dune" is the existing Dune: Part Two, which is
    // correctly dropped as a local duplicate; scenario 2 covers the TMDB arm.)
    await expect(page.getByText(/More results from Open Library/i)).toBeVisible(
      { timeout: 25_000 },
    );
  });

  test("an existing canonical title resolves to its current page without duplication", async ({
    page,
  }) => {
    const before = await countMediaBySlug(DUNE_SLUG);
    expect(before).toBe(1);

    // "linkme" is not a local catalog match, so the TMDB Dune candidate is NOT
    // dropped as a local duplicate. On a clean DB there is no provider link yet,
    // so it is offered for import; materializing it canonically LINKS to the
    // existing Dune: Part Two (same title + kind + year) instead of creating a
    // duplicate, and the browser lands on the current title page.
    await page.goto("/explore?q=linkme");

    const importDune = page.getByRole("button", {
      name: "Add Dune: Part Two to Favalog",
    });
    await expect(importDune).toBeVisible({ timeout: 25_000 });
    await importDune.click();

    await page.waitForURL(new RegExp(`/title/${DUNE_SLUG}$`), {
      timeout: 30_000,
    });

    // No second row was ever created for the existing canonical title.
    await expect(countMediaBySlug(DUNE_SLUG)).resolves.toBe(1);
  });

  test("a new fixture title materializes exactly once and lands on its title page", async ({
    page,
  }) => {
    expect(await countMediaByExternalId("tmdb", VOYAGER_EXTERNAL_ID)).toBe(0);

    await page.goto("/explore?q=voyager");

    const importVoyager = page.getByRole("button", {
      name: `Add ${VOYAGER_TITLE} to Favalog`,
    });
    await expect(importVoyager).toBeVisible({ timeout: 25_000 });
    await importVoyager.click();

    // (4) The browser finishes at /title/[slug].
    await page.waitForURL(/\/title\/[^/]+$/, { timeout: 30_000 });
    voyagerSlug = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(voyagerSlug).not.toBe("");

    await expect(
      page.getByRole("heading", { level: 1, name: VOYAGER_TITLE }),
    ).toBeVisible();

    // (3) Materialized exactly once.
    expect(await countMediaByExternalId("tmdb", VOYAGER_EXTERNAL_ID)).toBe(1);
  });

  test("refresh preserves the materialized title", async ({ page }) => {
    expect(voyagerSlug).not.toBe("");
    await page.goto(`/title/${voyagerSlug}`);
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: VOYAGER_TITLE }),
    ).toBeVisible();
  });

  test("the materialized title can use Log, Favorite, and Add-to-list", async ({
    page,
  }) => {
    expect(voyagerSlug).not.toBe("");
    await page.goto(`/title/${voyagerSlug}`);

    const actions = page.getByRole("group", {
      name: `Actions for ${VOYAGER_TITLE}`,
    });
    await expect(actions).toBeVisible();

    // Log opens the shared log dialog.
    await actions.getByRole("button", { name: "Log" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Add to list opens its dialog.
    await actions.getByRole("button", { name: "Add to list" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Favorite toggles to the pressed/favorited state (real write).
    await actions
      .getByRole("button", {
        name: `Add ${VOYAGER_TITLE} to your favorites`,
      })
      .click();
    await expect(
      actions.getByRole("button", {
        name: `Remove ${VOYAGER_TITLE} from your favorites`,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("repeating materialization is idempotent (no duplicate row)", async ({
    page,
  }) => {
    expect(voyagerSlug).not.toBe("");

    await page.goto("/explore?q=voyager");

    // Once materialized, the title is keyword-searchable, so it now appears as a
    // LOCAL result and its external candidate is dropped as a duplicate — it is
    // never offered for a second import. This is the idempotent outcome.
    await expect(
      page.getByRole("link", {
        name: /Fixture Voyager Chronicles \(Film, 2029\)/,
      }),
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      page.getByRole("button", { name: `Add ${VOYAGER_TITLE} to Favalog` }),
    ).toHaveCount(0);

    // Still exactly one row — repeating does not duplicate.
    expect(await countMediaByExternalId("tmdb", VOYAGER_EXTERNAL_ID)).toBe(1);
  });

  test("a dateless-Work book materializes via the Work-key year fallback", async ({
    page,
  }) => {
    expect(
      await countMediaByExternalId("openlibrary", SANDWORM_EXTERNAL_ID),
    ).toBe(0);

    await page.goto("/explore?q=sandworm");

    // The Open Library federated section streams in; the book's Work record
    // omits its publish date, so materialization only succeeds because the
    // adapter recovers the year (1965) via the exact Work-key Search fallback.
    // A year-0 record would be rejected before any write, so a successful
    // redirect is itself proof the fallback year passed validation.
    const importSandworm = page.getByRole("button", {
      name: `Add ${SANDWORM_TITLE} to Favalog`,
    });
    await expect(importSandworm).toBeVisible({ timeout: 25_000 });
    await importSandworm.click();

    await page.waitForURL(/\/title\/[^/]+$/, { timeout: 30_000 });
    sandwormSlug = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(sandwormSlug).not.toBe("");

    await expect(
      page.getByRole("heading", { level: 1, name: SANDWORM_TITLE }),
    ).toBeVisible();

    // Materialized exactly once.
    expect(
      await countMediaByExternalId("openlibrary", SANDWORM_EXTERNAL_ID),
    ).toBe(1);
  });

  test("refresh preserves the fallback-year book", async ({ page }) => {
    expect(sandwormSlug).not.toBe("");
    await page.goto(`/title/${sandwormSlug}`);
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: SANDWORM_TITLE }),
    ).toBeVisible();
  });

  test("repeating the fallback-year book import is idempotent (no duplicate row)", async ({
    page,
  }) => {
    expect(sandwormSlug).not.toBe("");

    await page.goto("/explore?q=sandworm");

    // Now keyword-searchable locally, so the external candidate is dropped as a
    // duplicate and never offered for a second import.
    await expect(
      page.getByRole("link", { name: /Fixture Sandworm Saga \(Book, 1965\)/ }),
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      page.getByRole("button", { name: `Add ${SANDWORM_TITLE} to Favalog` }),
    ).toHaveCount(0);

    // Still exactly one row — repeating does not duplicate.
    expect(
      await countMediaByExternalId("openlibrary", SANDWORM_EXTERNAL_ID),
    ).toBe(1);
  });
});
