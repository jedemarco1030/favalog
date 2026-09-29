import { expect, test } from "@playwright/test";

import {
  PROFILES,
  RUNS,
  describeFocus,
  longAnimationsUnderReducedMotion,
  measureRun,
  newProfileContext,
  recordEvidence,
  runAxe,
  summarizeRuns,
  type ProfileName,
} from "./lib/quality";

/**
 * Phase 4E quality baseline (laboratory evidence, not a gate).
 *
 * Runs in the CI `default` project against the production build. That build
 * has no Supabase or provider configuration, so Home, Explore, and title pages
 * render the labelled example catalog with local artwork. Provider-artwork and
 * Save-dialog measurements run in the `@fixtures` companion spec. Methodology
 * and results live in `docs/quality/baseline.md`.
 *
 * The assertions only check that each page rendered and that measurements were
 * collected. Findings are recorded as JSON attachments in the Playwright
 * report, so a noisy timing can never fail CI.
 */

const PAGES = [
  { id: "home", url: "/" },
  { id: "explore-empty", url: "/explore" },
  { id: "explore-search", url: "/explore?q=afterglow" },
  { id: "title-detail", url: "/title/afterglow" },
] as const;

const PROFILE_NAMES: ProfileName[] = ["mobile", "desktop"];

test.describe("quality baseline", () => {
  test.describe.configure({ mode: "serial" });

  for (const pageDef of PAGES) {
    for (const profileName of PROFILE_NAMES) {
      test(`performance ${pageDef.id} ${profileName}`, async ({
        browser,
      }, testInfo) => {
        test.setTimeout(240_000);
        const profile = PROFILES[profileName];

        // Warm the server (not the browser): the first request after
        // `next start` can include one-off work unrelated to page cost.
        const warm = await browser.newContext();
        await (await warm.newPage()).goto(pageDef.url);
        await warm.close();

        const runs = [];
        for (let i = 0; i < RUNS; i++) {
          runs.push(await measureRun(browser, profile, pageDef.url));
        }
        const summary = summarizeRuns(runs);
        expect(summary.median.ttfbMs).toBeGreaterThan(0);

        await recordEvidence(
          testInfo,
          `perf-${pageDef.id}-${profileName}`,
          summary,
        );
      });
    }

    test(`accessibility ${pageDef.id}`, async ({ browser }, testInfo) => {
      test.setTimeout(120_000);
      const evidence: Record<string, unknown> = {};

      for (const profileName of PROFILE_NAMES) {
        const context = await newProfileContext(browser, PROFILES[profileName]);
        const page = await context.newPage();
        await page.goto(pageDef.url);
        await expect(page.locator("main")).toBeVisible();
        evidence[`axe-${profileName}`] = await runAxe(page);
        await context.close();
      }

      // Keyboard entry point: the first three Tab stops from a fresh load.
      const kbContext = await newProfileContext(browser, PROFILES.desktop);
      const kbPage = await kbContext.newPage();
      await kbPage.goto(pageDef.url);
      const tabStops: string[] = [];
      for (let i = 0; i < 3; i++) {
        await kbPage.keyboard.press("Tab");
        tabStops.push(await describeFocus(kbPage));
      }
      evidence.firstTabStops = tabStops;
      evidence.hasSkipLink = /skip to (main )?content/i.test(tabStops[0]);
      await kbContext.close();

      const rmContext = await newProfileContext(browser, PROFILES.desktop, {
        reducedMotion: "reduce",
      });
      const rmPage = await rmContext.newPage();
      await rmPage.goto(pageDef.url);
      await rmPage.waitForTimeout(300);
      evidence.longAnimationsUnderReducedMotion =
        await longAnimationsUnderReducedMotion(rmPage);
      await rmContext.close();

      await recordEvidence(testInfo, `a11y-${pageDef.id}`, evidence);
    });
  }
});
