import path from "node:path";

import { expect, test } from "./fixtures/test";
import {
  FIXTURE_SURFACES,
  waitForFixtureSurface,
} from "./lib/fixture-readiness";

import { routeProviderArtwork } from "./lib/fixture-artwork";

/**
 * Deterministic README/case-study screenshots from the configured fixture
 * environment (production build, local Supabase, offline provider fixtures,
 * fixture artwork). CI uploads them as the `portfolio-screenshots` artifact;
 * a maintainer reviews and commits the chosen images to docs/screenshots/.
 * These never capture live-provider or production data.
 */

const DISCOVERY_TITLE = "Fixture Lantern Coast";

for (const profile of [
  { name: "desktop", viewport: { width: 1280, height: 800 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
]) {
  test.describe(`@fixtures portfolio screenshots ${profile.name}`, () => {
    test.use({ viewport: profile.viewport, colorScheme: "dark" });

    test.beforeEach(async ({ context }) => {
      await routeProviderArtwork(context);
    });

    function outputFile(
      testInfo: import("@playwright/test").TestInfo,
      name: string,
    ) {
      const dir = process.env.SCREENSHOT_DIR?.trim();
      return dir
        ? path.join(dir, `${name}.png`)
        : testInfo.outputPath(`${name}.png`);
    }

    for (const shot of FIXTURE_SURFACES) {
      test(`captures ${shot.id}`, async ({ page }, testInfo) => {
        await page.goto(shot.url, { waitUntil: "load" });
        await waitForFixtureSurface(page, true);
        await page.screenshot({
          path: outputFile(testInfo, `${shot.id}-${profile.name}`),
          fullPage: true,
          animations: "disabled",
        });
      });
    }

    test("captures the save dialog", async ({ page }, testInfo) => {
      await page.goto("/explore");
      await waitForFixtureSurface(page, true);
      const save = page
        .getByRole("button", { name: `Save ${DISCOVERY_TITLE} to a list` })
        .first();
      await expect(save).toBeVisible({ timeout: 25_000 });
      await save.click();
      await expect(
        page.getByRole("dialog", { name: `Save “${DISCOVERY_TITLE}”` }),
      ).toBeVisible();
      await expect(
        page.getByRole("dialog").getByRole("button", { name: "Save to list" }),
      ).toBeEnabled();
      await page.screenshot({
        path: outputFile(testInfo, `save-dialog-${profile.name}`),
        animations: "disabled",
      });
    });
  });
}
