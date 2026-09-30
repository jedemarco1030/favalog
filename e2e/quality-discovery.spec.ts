import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/test";
import { routeProviderArtwork } from "./lib/fixture-artwork";
import { waitForFixtureSurface } from "./lib/fixture-readiness";

import {
  PROFILES,
  RUNS,
  describeFocus,
  measureRun,
  recordEvidence,
  runAxeDetails,
  summarizeRuns,
} from "./lib/quality";

/**
 * Phase 4E quality baseline for provider-discovery surfaces (laboratory
 * evidence, not a gate). Runs in the `@fixtures` suite: local Supabase, a
 * signed-in fixture user, and the offline provider fixture server supplying
 * "Fixture Lantern Coast" to Explore's discovery overview.
 *
 * CI runs this suite in the `explore-integration` job.
 */

const DISCOVERY_TITLE = "Fixture Lantern Coast";

async function openSaveDialog(page: Page) {
  await page.goto("/explore");
  await waitForFixtureSurface(page);
  const save = page
    .getByRole("button", { name: `Save ${DISCOVERY_TITLE} to a list` })
    .first();
  await expect(save).toBeVisible({ timeout: 25_000 });
  await save.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: `Save “${DISCOVERY_TITLE}”`,
  });
  await expect(dialog).toBeVisible();
  return { dialog, trigger: save };
}

test.describe("@fixtures quality discovery", () => {
  test.describe.configure({ mode: "serial" });

  test("performance explore discovery overview (mobile, desktop)", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    for (const profile of [PROFILES.mobile, PROFILES.desktop]) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        runs.push(
          await measureRun(browser, profile, "/explore", {
            setup: async (context) => {
              await routeProviderArtwork(context);
            },
            ready: waitForFixtureSurface,
          }),
        );
      }
      await recordEvidence(
        testInfo,
        `perf-explore-discovery-${profile.name}`,
        summarizeRuns(runs),
      );
    }
  });

  test("save dialog keyboard, focus, and automated checks", async ({
    page,
  }, testInfo) => {
    const { dialog, trigger } = await openSaveDialog(page);

    const initialFocus = await describeFocus(page);
    const dialogAxe = await runAxeDetails(page, "dialog[open]");

    // Tab through twelve stops. A native modal <dialog> makes the page inert,
    // so after the last control Chromium hands focus to the browser chrome,
    // which reads as `document.body`. That is expected and recorded
    // separately; only focus landing on a page element outside the dialog
    // is a real trap leak.
    const escapedFocus: string[] = [];
    let browserChromeStops = 0;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(i < 6 ? "Tab" : "Shift+Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "chrome";
        return el.closest("dialog[open]") ? "inside" : "outside";
      });
      if (where === "chrome") browserChromeStops += 1;
      if (where === "outside") escapedFocus.push(await describeFocus(page));
    }

    await dialog.getByRole("button", { name: "Create new list" }).focus();
    await page.keyboard.press("Enter");
    const createFormFocus = await describeFocus(page);
    const createFormAxe = await runAxeDetails(page, "dialog[open]");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const focusReturnedToTrigger = await trigger.evaluate(
      (el) => el === document.activeElement,
    );

    expect(escapedFocus).toEqual([]);
    expect(focusReturnedToTrigger).toBe(true);
    expect(createFormFocus).toContain("input");
    expect(dialogAxe.violations).toEqual([]);
    expect(createFormAxe.violations).toEqual([]);
    await recordEvidence(testInfo, "a11y-save-dialog", {
      initialFocus,
      escapedFocus,
      browserChromeStops,
      createFormFocus,
      focusReturnedToTrigger,
      dialogAxe,
      createFormAxe,
    });
  });
});
