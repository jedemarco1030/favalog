import path from "node:path";

import { expect, test } from "@playwright/test";

import { routeProviderArtwork } from "./lib/fixture-artwork";

/**
 * Deterministic README/case-study screenshots from the configured fixture
 * environment (production build, local Supabase, offline provider fixtures,
 * fixture artwork). CI uploads them as the `portfolio-screenshots` artifact;
 * a maintainer reviews and commits the chosen images to docs/screenshots/.
 * These never capture live-provider or production data.
 */

const DISCOVERY_TITLE = "Fixture Lantern Coast";

test.describe("@fixtures portfolio screenshots", () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });

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

  for (const shot of [
    { name: "home", url: "/" },
    { name: "explore-discovery", url: "/explore" },
    { name: "explore-search", url: "/explore?q=dune" },
    { name: "title-detail", url: "/title/dune-part-two" },
  ]) {
    test(`captures ${shot.name}`, async ({ page }, testInfo) => {
      await page.goto(shot.url, { waitUntil: "load" });
      await expect(page.getByRole("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: outputFile(testInfo, shot.name),
        animations: "disabled",
      });
    });
  }

  test("captures the save dialog", async ({ page }, testInfo) => {
    await page.goto("/explore");
    const save = page
      .getByRole("button", { name: `Save ${DISCOVERY_TITLE} to a list` })
      .first();
    await expect(save).toBeVisible({ timeout: 25_000 });
    await save.click();
    await expect(
      page.getByRole("dialog", { name: `Save “${DISCOVERY_TITLE}”` }),
    ).toBeVisible();
    await page.screenshot({
      path: outputFile(testInfo, "save-dialog"),
      animations: "disabled",
    });
  });
});
