import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

/**
 * Laboratory quality measurements for the Phase 4E baseline.
 *
 * These are LAB numbers from a single CI runner, not real-user metrics. Real
 * users are measured separately by Vercel Speed Insights. Nothing here is a
 * pass/fail gate on timing: timings are recorded as medians of repeated runs
 * and compared across commits by a human. See `docs/quality/baseline.md`.
 */

export type ProfileName = "mobile" | "desktop";

export interface MeasurementProfile {
  name: ProfileName;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  /** CDP CPU slowdown multiplier; 1 disables throttling. */
  cpuThrottle: number;
  /** CDP network conditions; null disables throttling. */
  network: {
    latencyMs: number;
    downloadBytesPerSec: number;
    uploadBytesPerSec: number;
  } | null;
}

/**
 * Mobile approximates Lighthouse's default mobile preset (4x CPU, ~150 ms RTT,
 * ~1.6 Mbps down). Desktop is unthrottled. Both are applied through CDP, so
 * the harness is Chromium-only.
 */
export const PROFILES: Record<ProfileName, MeasurementProfile> = {
  mobile: {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    cpuThrottle: 4,
    network: {
      latencyMs: 150,
      downloadBytesPerSec: (1.6 * 1024 * 1024) / 8,
      uploadBytesPerSec: (750 * 1024) / 8,
    },
  },
  desktop: {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    cpuThrottle: 1,
    network: null,
  },
};

/** Repeated cold-cache runs per page and profile; the median is reported. */
export const RUNS = 3;

export interface ImageSample {
  src: string;
  alt: string | null;
  loading: string;
  fetchPriority: string;
  renderedWidth: number;
  naturalWidth: number;
  /** naturalWidth / (renderedWidth * devicePixelRatio). >2 means oversized. */
  oversizeRatio: number;
  inInitialViewport: boolean;
  transferBytes: number;
}

export interface LayoutShiftSample {
  value: number;
  atMs: number;
  nodes: string[];
}

export interface RunMetrics {
  settledMs: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  lcpMs: number | null;
  lcpElement: string | null;
  /** Sum of layout-shift entries without recent input (not session-windowed). */
  cls: number;
  /** Largest individual layout shifts (≥ 0.001) with their source nodes. */
  shifts: LayoutShiftSample[];
  scriptBytes: number;
  scriptCount: number;
  imageBytes: number;
  imageCount: number;
  totalBytes: number;
  images: ImageSample[];
}

const OBSERVER_SCRIPT = `
  window.__favalogLab = { lcp: null, lcpElement: null, cls: 0, shifts: [] };
  const describeNode = (n) => {
    if (!n || n.nodeType !== 1) return "text";
    const id = n.id ? "#" + n.id : "";
    const cls = typeof n.className === "string" && n.className
      ? "." + n.className.trim().split(/\\s+/).slice(0, 3).join(".")
      : "";
    const label = n.getAttribute("aria-label") || (n.textContent || "").trim().slice(0, 30);
    return n.tagName.toLowerCase() + id + cls + (label ? "(" + label + ")" : "");
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__favalogLab.lcp = entry.startTime;
        const el = entry.element;
        window.__favalogLab.lcpElement = el
          ? el.tagName.toLowerCase() +
            (el.getAttribute("src") ? "[src=" + el.getAttribute("src").slice(0, 120) + "]" : "") +
            (el.textContent && el.tagName !== "IMG" ? "(" + el.textContent.trim().slice(0, 40) + ")" : "")
          : null;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__favalogLab.cls += entry.value;
        if (entry.value >= 0.001 && window.__favalogLab.shifts.length < 10) {
          window.__favalogLab.shifts.push({
            value: Math.round(entry.value * 10000) / 10000,
            atMs: Math.round(entry.startTime),
            nodes: (entry.sources || []).slice(0, 3).map((s) => describeNode(s.node)),
          });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {}
`;

export interface ProfileContextOptions {
  reducedMotion?: "reduce" | "no-preference";
  colorScheme?: "dark" | "light";
  /** A signed-in storage state file; omit for a signed-out context. */
  storageState?: string;
  /** Runs after the context exists, before any navigation (e.g. routing). */
  setup?: (context: BrowserContext) => Promise<void>;
  /** Observation endpoint only; the observer starts before navigation. */
  ready?: (page: Page) => Promise<void>;
}

export async function newProfileContext(
  browser: Browser,
  profile: MeasurementProfile,
  options: ProfileContextOptions = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    reducedMotion: options.reducedMotion ?? "no-preference",
    colorScheme: options.colorScheme ?? "dark",
    storageState: options.storageState,
  });
  await context.addInitScript(OBSERVER_SCRIPT);
  if (options.setup) await options.setup(context);
  return context;
}

async function applyThrottling(page: Page, profile: MeasurementProfile) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (profile.network) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: profile.network.latencyMs,
      downloadThroughput: profile.network.downloadBytesPerSec,
      uploadThroughput: profile.network.uploadBytesPerSec,
    });
  }
  if (profile.cpuThrottle > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: profile.cpuThrottle,
    });
  }
}

/** One cold-cache navigation in a fresh context, then a settle window. */
export async function measureRun(
  browser: Browser,
  profile: MeasurementProfile,
  url: string,
  options: ProfileContextOptions = {},
): Promise<RunMetrics> {
  const context = await newProfileContext(browser, profile, options);
  try {
    const page = await context.newPage();
    await applyThrottling(page, profile);
    await page.goto(url, { waitUntil: "load", timeout: 90_000 });
    if (options.ready) await options.ready(page);
    const settledMs = await page.evaluate(() => Math.round(performance.now()));
    await page
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => undefined);
    // Let late layout shifts and LCP candidates land.
    await page.waitForTimeout(1_500);

    const metrics = await page.evaluate(() => {
      type Lab = {
        lcp: number | null;
        lcpElement: string | null;
        cls: number;
        shifts: { value: number; atMs: number; nodes: string[] }[];
      };
      const lab = (window as unknown as { __favalogLab: Lab }).__favalogLab;
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const bytes = (r: PerformanceResourceTiming) =>
        r.transferSize || r.encodedBodySize || 0;
      const scripts = resources.filter((r) => r.initiatorType === "script");
      const imageResources = resources.filter(
        (r) =>
          r.initiatorType === "img" ||
          /\/_next\/image|\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/.test(r.name),
      );
      const byUrl = new Map(imageResources.map((r) => [r.name, bytes(r)]));
      const dpr = window.devicePixelRatio || 1;
      const vh = window.innerHeight;
      const images = Array.from(document.images).map((img) => {
        const rect = img.getBoundingClientRect();
        const rendered = Math.round(rect.width);
        const absolute = img.currentSrc || img.src;
        return {
          src: absolute.replace(location.origin, "").slice(0, 200),
          alt: img.getAttribute("alt"),
          loading: img.loading || "auto",
          fetchPriority: img.getAttribute("fetchpriority") || "auto",
          renderedWidth: rendered,
          naturalWidth: img.naturalWidth,
          oversizeRatio:
            rendered > 0
              ? Math.round((img.naturalWidth / (rendered * dpr)) * 100) / 100
              : 0,
          inInitialViewport: rect.top < vh && rect.bottom > 0 && rendered > 0,
          transferBytes: byUrl.get(absolute) ?? 0,
        };
      });
      return {
        ttfbMs: Math.round(nav.responseStart),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        lcpMs: lab.lcp === null ? null : Math.round(lab.lcp),
        lcpElement: lab.lcpElement,
        cls: Math.round(lab.cls * 10000) / 10000,
        shifts: lab.shifts,
        scriptBytes: scripts.reduce((sum, r) => sum + bytes(r), 0),
        scriptCount: scripts.length,
        imageBytes: imageResources.reduce((sum, r) => sum + bytes(r), 0),
        imageCount: imageResources.length,
        totalBytes:
          resources.reduce((sum, r) => sum + bytes(r), 0) +
          (nav.transferSize || 0),
        images,
      };
    });
    return { settledMs, ...metrics };
  } finally {
    await context.close();
  }
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10000) / 10000;
}

export function summarizeRuns(runs: RunMetrics[]) {
  const pick = (key: keyof RunMetrics) =>
    median(runs.map((r) => Number(r[key] ?? 0)));
  const last = runs[runs.length - 1];
  return {
    runs: runs.length,
    samples: runs,
    median: {
      settledMs: pick("settledMs"),
      ttfbMs: pick("ttfbMs"),
      domContentLoadedMs: pick("domContentLoadedMs"),
      loadMs: pick("loadMs"),
      lcpMs: pick("lcpMs"),
      cls: pick("cls"),
      scriptBytes: pick("scriptBytes"),
      imageBytes: pick("imageBytes"),
      totalBytes: pick("totalBytes"),
    },
    lcpElements: runs.map((r) => r.lcpElement),
    layoutShifts: runs.map((r) => r.shifts),
    scriptCount: last.scriptCount,
    imageCount: last.imageCount,
    oversizedImages: last.images.filter((i) => i.oversizeRatio > 2),
    lazyInInitialViewport: last.images.filter(
      (i) => i.inInitialViewport && i.loading === "lazy",
    ),
    highPriorityImages: last.images.filter((i) => i.fetchPriority === "high"),
    imagesMissingAlt: last.images.filter((i) => i.alt === null),
  };
}

export interface AxeViolationSummary {
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
  targets: string[];
}

const AXE_PATH = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

/**
 * Runs axe-core (the engine already used by Storybook's a11y addon) against
 * the page or a scoped selector. Automated checks find only a subset of
 * accessibility problems; a clean run is not a compliance claim.
 */
export async function runAxeDetails(
  page: Page,
  include?: string,
): Promise<{
  violations: AxeViolationSummary[];
  incomplete: AxeViolationSummary[];
}> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async (scope) => {
    type AxeFinding = {
      id: string;
      impact: string | null;
      help: string;
      nodes: { target: string[] }[];
    };
    type AxeResult = { violations: AxeFinding[]; incomplete: AxeFinding[] };
    const axe = (
      window as unknown as {
        axe: { run: (ctx: unknown, opts: unknown) => Promise<AxeResult> };
      }
    ).axe;
    const result = await axe.run(scope ? { include: [scope] } : document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    });
    const summarize = (findings: AxeFinding[]) =>
      findings.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      }));
    return {
      violations: summarize(result.violations),
      incomplete: summarize(result.incomplete),
    };
  }, include ?? null);
}

export async function runAxe(
  page: Page,
  include?: string,
): Promise<AxeViolationSummary[]> {
  return (await runAxeDetails(page, include)).violations;
}

/** Describes the focused element in a stable, human-readable way. */
export async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "body";
    const name =
      el.getAttribute("aria-label") ||
      el.textContent?.trim().replace(/\s+/g, " ").slice(0, 40) ||
      el.getAttribute("name") ||
      "";
    const href = el.getAttribute("href");
    return `${el.tagName.toLowerCase()}${href ? `[href=${href}]` : ""}${name ? ` "${name}"` : ""}`;
  });
}

/** Animations/transitions still longer than 50 ms under reduced motion. */
export async function longAnimationsUnderReducedMotion(
  page: Page,
): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => {
        const timing = a.effect?.getComputedTiming();
        const duration = Number(timing?.duration ?? 0);
        return a.playState === "running" && duration > 50;
      })
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        const name =
          (a as CSSAnimation).animationName ??
          (a as CSSTransition).transitionProperty ??
          "animation";
        return `${name} on ${target?.tagName.toLowerCase() ?? "?"}${
          target?.className && typeof target.className === "string"
            ? "." + target.className.split(" ").slice(0, 2).join(".")
            : ""
        }`;
      })
      .slice(0, 20),
  );
}

/** Attaches JSON evidence to the HTML report and prints a one-line summary. */
export async function recordEvidence(
  testInfo: TestInfo,
  name: string,
  data: unknown,
) {
  const body = JSON.stringify(data, null, 2);
  await testInfo.attach(`${name}.json`, {
    body,
    contentType: "application/json",
  });
  // CI uploads this directory as a raw artifact so the numbers in
  // docs/quality/baseline.md can cite a downloadable file, not only a report.
  const dir = process.env.QUALITY_EVIDENCE_DIR?.trim();
  if (dir) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${name}.json`), body);
  }
  console.log(`[quality] ${name} ${JSON.stringify(data).slice(0, 1500)}`);
}
