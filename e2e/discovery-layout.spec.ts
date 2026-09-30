import { expect, test } from "@playwright/test";
import { routeProviderArtwork } from "./lib/fixture-artwork";
import {
  PROFILES,
  RUNS,
  measureRun,
  recordEvidence,
  summarizeRuns,
} from "./lib/quality";

const scenario = process.env.E2E_DISCOVERY_SCENARIO ?? "slow";
test.describe("@layout discovery first, settled provider scenarios", () => {
  for (const profile of [PROFILES.mobile, PROFILES.desktop].filter(
    (profile) =>
      !process.env.E2E_LAYOUT_PROFILE ||
      profile.name === process.env.E2E_LAYOUT_PROFILE,
  )) {
    test(`${scenario} ${profile.name}`, async ({ browser }, testInfo) => {
      test.setTimeout(180_000);
      const runs = [];
      for (let index = 0; index < RUNS; index++) {
        runs.push(
          await measureRun(browser, profile, "/explore", {
            setup: async (context) => {
              await routeProviderArtwork(context);
            },
            ready: async (page) => {
              await expect(
                page.locator("[data-discovery-settled]"),
              ).toBeVisible();
              await expect(
                page.getByRole("region", { name: "Browse the catalog" }),
              ).toBeVisible();
              await expect(page.getByText(/Editorial examples/)).toHaveCount(0);
              await expect(
                page.getByRole("region", { name: "Loading discovery" }),
              ).toHaveCount(0);
              if (scenario === "slow" || scenario === "partial") {
                const shelf = page.locator('[data-shelf="movie-trending"]');
                await expect(shelf).toBeVisible();
                const discovery = await shelf.boundingBox();
                const catalog = await page
                  .getByRole("region", { name: "Browse the catalog" })
                  .boundingBox();
                expect(discovery!.y + discovery!.height).toBeLessThan(
                  catalog!.y,
                );
                if (scenario === "partial")
                  await expect(
                    page.locator('[data-shelf="book-trending"]'),
                  ).toHaveCount(0);
              } else await expect(page.locator("[data-shelf]")).toHaveCount(0);
            },
          }),
        );
      }
      if (scenario === "slow") {
        expect(
          runs[0].settledMs,
          "cold navigation must include the 2000ms provider delay",
        ).toBeGreaterThanOrEqual(1900);
      }
      await recordEvidence(testInfo, `layout-${scenario}-${profile.name}`, {
        scenario,
        environment:
          "configured local Supabase, offline providers, production build",
        note: "Observer begins before navigation. Separate server/cache key per scenario and profile; health probe does not warm discovery. First sample includes cold provider reads (2000ms delay in slow); subsequent samples use warm server cache. Browser cache is disabled; route-fulfilled artwork does not reproduce CDN/optimizer latency. Inspect cold sample as well as median.",
        ...summarizeRuns(runs),
      });
    });
  }
});
