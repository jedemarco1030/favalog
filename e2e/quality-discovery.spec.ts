import { expect, test, type Page } from "@playwright/test";

import {
  PROFILES,
  RUNS,
  describeFocus,
  measureRun,
  recordEvidence,
  runAxe,
  summarizeRuns,
} from "./lib/quality";

/**
 * Phase 4E quality baseline for provider-discovery surfaces (laboratory
 * evidence, not a gate). Runs in the `@fixtures` suite: local Supabase, a
 * signed-in fixture user, and the offline provider fixture server supplying
 * "Fixture Lantern Coast" to Explore's discovery overview.
 *
 * The fixtures suite is not yet wired into CI; see
 * `docs/ci/fixtures-e2e-ci-handoff.md`.
 */

const DISCOVERY_TITLE = "Fixture Lantern Coast";

async function openSaveDialog(page: Page) {
  await page.goto("/explore");
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
        runs.push(await measureRun(browser, profile, "/explore"));
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
    const dialogAxe = await runAxe(page, "dialog[open]");

    // Tab through twelve stops and record whether focus ever leaves the
    // dialog. Native modal <dialog> should keep it inside.
    const escapedFocus: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest("dialog[open]"),
      );
      if (!inside) escapedFocus.push(await describeFocus(page));
    }

    await dialog.getByRole("button", { name: "Create new list" }).focus();
    await page.keyboard.press("Enter");
    const createFormFocus = await describeFocus(page);
    const createFormAxe = await runAxe(page, "dialog[open]");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const focusReturnedToTrigger = await trigger.evaluate(
      (el) => el === document.activeElement,
    );

    await recordEvidence(testInfo, "a11y-save-dialog", {
      initialFocus,
      escapedFocus,
      createFormFocus,
      focusReturnedToTrigger,
      dialogAxe,
      createFormAxe,
    });
  });
});
