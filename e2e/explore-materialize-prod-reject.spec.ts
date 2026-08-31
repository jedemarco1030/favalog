import { expect, test } from "@playwright/test";

/**
 * Scenario 9 — a PRODUCTION runtime must REJECT the test-only provider transport
 * override (Catalog Platform v1B).
 *
 * This runs in the `fixtures-prod-reject` project, whose `next start` is launched
 * with `VERCEL_ENV=production` plus the same transport envs the fixtures suite
 * uses. Because `resolveTestProviderBaseUrl` refuses the override under a
 * production runtime, the app never talks to the local fixture server, so the
 * fixture-only title cannot appear. (The real provider host is then used with a
 * fake token and simply fails closed to a controlled unavailable state — the
 * point is that the fixture data is absent.)
 *
 * The override is server-only and env-driven, so it likewise cannot be turned on
 * by any query parameter, header, cookie, or other browser input.
 */

const VOYAGER_TITLE = "Fixture Voyager Chronicles";

test.describe("@prodreject production rejects the test provider override", () => {
  test("fixture-only title never appears; Explore stays local-only", async ({
    page,
  }) => {
    await page.goto("/explore?q=voyager");

    // The Explore page still renders (local experience is unaffected).
    await expect(
      page.getByRole("heading", { level: 1, name: "Explore" }),
    ).toBeVisible();

    // The override was rejected, so the fixture server was never used and its
    // fixture-only title is absent.
    await expect(page.getByText(VOYAGER_TITLE)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Add ${VOYAGER_TITLE} to Favalog` }),
    ).toHaveCount(0);
  });
});
