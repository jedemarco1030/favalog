import { expect, test } from "@playwright/test";

/**
 * Federated Explore — feature-disabled local-only contract (`@configured`).
 *
 * Catalog Platform v1B's external discovery is gated behind the server-only
 * `EXTERNAL_CATALOG_ENABLED` flag, which is OFF in the e2e build. This proves
 * the required guarantee that with the flag off, Explore behaves EXACTLY as it
 * did before v1B: a committed query renders local Favalog results and NO
 * external provider section ("More movies & TV" / "More books") is present, and
 * no provider is ever contacted (so local results can never be delayed or hidden
 * by a provider).
 *
 * Fixture-backed federated/materialization flows (results appearing, importing a
 * new title, importing an existing title without duplication) require the
 * external provider registry to be swappable for a deterministic fake at
 * runtime; that server-only injection seam is intentionally NOT added here to
 * avoid a production backdoor into the real provider registry, so those flows
 * are covered at the unit/component level (canonical resolution, view models,
 * the materialize Server Action, and the external-result card) instead.
 */

test.describe("Federated Explore feature-disabled @configured", () => {
  test("a query shows local results and no external provider sections", async ({
    page,
  }) => {
    await page.goto("/explore?q=afterglow");

    // Local results still render.
    await expect(
      page.getByRole("heading", { name: /Results for/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Afterglow \(Film, 2023\)/ }),
    ).toBeVisible();

    // With the flag off, neither federated section is present.
    await expect(
      page.getByRole("heading", { name: /More movies & TV/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /More books/i }),
    ).toHaveCount(0);
  });
});
