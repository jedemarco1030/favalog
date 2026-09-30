import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures/test";
import {
  FIXTURE_SURFACES,
  waitForFixtureSurface,
} from "./lib/fixture-readiness";

import { routeProviderArtwork, type ArtworkStats } from "./lib/fixture-artwork";
import {
  PROFILES,
  RUNS,
  median,
  measureRun,
  newProfileContext,
  recordEvidence,
  runAxeDetails,
  summarizeRuns,
} from "./lib/quality";

/**
 * Configured-fixture quality evidence: the PRODUCTION build, local Supabase,
 * the offline provider fixtures, a signed-in fixture user, and representative
 * provider artwork (see e2e/lib/fixture-artwork.ts for what that does and does
 * not represent). This is laboratory evidence, not real-user or live
 * production data. Raw JSON is uploaded by CI as the
 * `quality-evidence-configured-fixtures` artifact.
 *
 * Performance numbers are recorded, not gated. Reflow, zoom, reduced motion,
 * and contrast are definite assertions.
 */

const STORAGE_STATE = "e2e/.auth/fixtures-user.json";
const DISCOVERY_TITLE = "Fixture Lantern Coast";

const PAGES = FIXTURE_SURFACES;

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= viewport + 1) continue;
      // Intentional horizontal scrollers (shelves) clip their children.
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (
          overflowX === "auto" ||
          overflowX === "scroll" ||
          overflowX === "hidden"
        ) {
          clipped = true;
          break;
        }
      }
      if (!clipped) {
        offenders.push(
          `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${(el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".")}`,
        );
      }
    }
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 10),
    };
  });
}

async function withArtworkContext(context: BrowserContext): Promise<void> {
  await routeProviderArtwork(context);
}

test.describe("@fixtures quality configured", () => {
  test.describe.configure({ mode: "serial" });

  test("performance with representative artwork (mobile, desktop)", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(900_000);
    for (const { id, url } of PAGES) {
      for (const profile of [PROFILES.mobile, PROFILES.desktop]) {
        const runs = [];
        const artwork: ArtworkStats[] = [];
        for (let i = 0; i < RUNS; i++) {
          runs.push(
            await measureRun(browser, profile, url, {
              storageState: STORAGE_STATE,
              ready: waitForFixtureSurface,
              setup: async (context) => {
                artwork.push(await routeProviderArtwork(context));
              },
            }),
          );
        }
        for (let i = 0; i < RUNS; i++) {
          expect(
            artwork[i].requests,
            `${id}: expected offline artwork requests`,
          ).toBeGreaterThan(0);
          expect(
            runs[i].imageCount,
            `${id}: expected measured image resources`,
          ).toBeGreaterThan(0);
          expect(
            runs[i].images.filter(
              (image) => image.inInitialViewport && image.naturalWidth > 0,
            ).length,
          ).toBeGreaterThan(0);
        }
        await recordEvidence(
          testInfo,
          `configured-perf-${id}-${profile.name}`,
          {
            environment:
              "production build, local Supabase, offline provider fixtures, fixture artwork",
            url,
            ...summarizeRuns(runs),
            artworkRequestsMedian: median(artwork.map((a) => a.requests)),
            artworkBytesMedian: median(artwork.map((a) => a.bytes)),
          },
        );
      }
    }
  });

  test("save dialog open latency", async ({ browser }, testInfo) => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const context = await newProfileContext(browser, PROFILES.mobile, {
        storageState: STORAGE_STATE,
        setup: withArtworkContext,
      });
      const page = await context.newPage();
      await page.goto("/explore");
      const save = page
        .getByRole("button", { name: `Save ${DISCOVERY_TITLE} to a list` })
        .first();
      await expect(save).toBeVisible({ timeout: 25_000 });
      const dialog = page.getByRole("dialog", {
        name: `Save “${DISCOVERY_TITLE}”`,
      });
      const started = Date.now();
      await save.click();
      await expect(dialog).toBeVisible();
      samples.push(Date.now() - started);
      await context.close();
    }
    await recordEvidence(testInfo, "configured-save-dialog-open", {
      note: "Wall-clock ms from click to visible dialog, unthrottled mobile viewport; includes Playwright polling overhead.",
      samples,
      medianMs: median(samples),
    });
  });

  test("320px reflow has no page-level horizontal scrolling", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      storageState: STORAGE_STATE,
    });
    await routeProviderArtwork(context);
    const page = await context.newPage();
    const results: Record<
      string,
      Awaited<ReturnType<typeof horizontalOverflow>>
    > = {};
    for (const { id, url } of PAGES) {
      await page.goto(url, { waitUntil: "load" });
      await waitForFixtureSurface(page, true);
      results[id] = await horizontalOverflow(page);
    }
    await context.close();
    await recordEvidence(testInfo, "configured-reflow-320", results);
    for (const [id, result] of Object.entries(results)) {
      expect(
        result.scrollWidth,
        `${id}: ${result.offenders.join(", ")}`,
      ).toBeLessThanOrEqual(result.viewport);
    }
  });

  test("200% zoom-equivalent viewport keeps content reachable (not actual browser zoom)", async ({
    browser,
  }, testInfo) => {
    // 200% browser zoom of a 1280x800 window is a 640x400 CSS viewport at 2x.
    const context = await browser.newContext({
      viewport: { width: 640, height: 400 },
      deviceScaleFactor: 2,
      storageState: STORAGE_STATE,
    });
    await routeProviderArtwork(context);
    const page = await context.newPage();
    const results: Record<
      string,
      Awaited<ReturnType<typeof horizontalOverflow>>
    > = {};
    for (const { id, url } of PAGES) {
      await page.goto(url, { waitUntil: "load" });
      await waitForFixtureSurface(page, true);
      results[id] = await horizontalOverflow(page);
    }
    await page.goto("/explore");
    const save = page
      .getByRole("button", { name: `Save ${DISCOVERY_TITLE} to a list` })
      .first();
    await expect(save).toBeVisible({ timeout: 25_000 });
    await save.click();
    const dialog = page.getByRole("dialog", {
      name: `Save “${DISCOVERY_TITLE}”`,
    });
    await expect(dialog).toBeVisible();
    const submit = dialog.getByRole("button", { name: "Save to list" });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    await context.close();

    await recordEvidence(testInfo, "configured-zoom-200", results);
    for (const [id, result] of Object.entries(results)) {
      expect(
        result.scrollWidth,
        `${id}: ${result.offenders.join(", ")}`,
      ).toBeLessThanOrEqual(result.viewport);
    }
  });

  test("reduced motion removes dialog and card motion", async ({
    browser,
  }, testInfo) => {
    const context = await newProfileContext(browser, PROFILES.desktop, {
      reducedMotion: "reduce",
      storageState: STORAGE_STATE,
      setup: withArtworkContext,
    });
    const page = await context.newPage();
    await page.goto("/explore");
    const save = page
      .getByRole("button", { name: `Save ${DISCOVERY_TITLE} to a list` })
      .first();
    await expect(save).toBeVisible({ timeout: 25_000 });
    await save.click();
    await expect(
      page.getByRole("dialog", { name: `Save “${DISCOVERY_TITLE}”` }),
    ).toBeVisible();

    const longest = await page.evaluate(() => {
      const seconds = (value: string) =>
        Math.max(
          0,
          ...value.split(",").map((part) => {
            const n = Number.parseFloat(part);
            return part.trim().endsWith("ms") ? n / 1000 : n;
          }),
        );
      let max = 0;
      let element = "";
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const style = getComputedStyle(el);
        const duration = Math.max(
          seconds(
            style.animationName === "none" ? "0s" : style.animationDuration,
          ),
          seconds(style.transitionDuration),
        );
        if (duration > max) {
          max = duration;
          element = `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".")}`;
        }
      }
      return { maxSeconds: max, element };
    });
    await context.close();

    await recordEvidence(testInfo, "configured-reduced-motion", longest);
    expect(longest.maxSeconds, longest.element).toBeLessThanOrEqual(0.01);
  });

  test("text over artwork passes automated contrast checks", async ({
    browser,
  }, testInfo) => {
    const results: Record<
      string,
      Awaited<ReturnType<typeof runAxeDetails>>
    > = {};
    for (const colorScheme of ["dark", "light"] as const) {
      for (const profile of [PROFILES.mobile, PROFILES.desktop]) {
        const context = await newProfileContext(browser, profile, {
          colorScheme,
          storageState: STORAGE_STATE,
          setup: withArtworkContext,
        });
        const page = await context.newPage();
        for (const { id, url } of PAGES) {
          await page.goto(url, { waitUntil: "load" });
          await waitForFixtureSurface(page, true);
          results[`${id}-${profile.name}-${colorScheme}`] =
            await runAxeDetails(page);
        }
        await context.close();
      }
    }
    await recordEvidence(testInfo, "configured-contrast", {
      note: "axe color-contrast over fixture artwork. axe reports text on images as incomplete, not passing; see docs/quality/baseline.md for the manual review.",
      results,
    });
    for (const [id, findings] of Object.entries(results)) {
      expect(findings.violations, id).toEqual([]);
    }
  });
});
