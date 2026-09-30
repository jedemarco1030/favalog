# Phase 4E quality baseline

This file records laboratory (lab) measurements. They come from a CI runner
under controlled conditions and are **not** real-user metrics. Real-user
field data comes separately from Vercel Speed Insights (`<SpeedInsights />` in
`app/layout.tsx`) and is not reproduced here. An automated axe scan with no
violations does **not** establish accessibility compliance. It catches only a
subset of issues. Keyboard, focus, and screen-reader behavior are checked
explicitly, and the parts that need a human are listed under "Manual checks".

## Status

| Item                                                               | State                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Harness (`e2e/lib/quality.ts`)                                     | Implemented; typechecked and linted                          |
| Page baseline (`e2e/quality-baseline.spec.ts`)                     | Runs in CI `default` project; results recorded below         |
| Save-dialog quality (`e2e/quality-discovery.spec.ts`, `@fixtures`) | Runs in CI `explore-integration` job; results recorded below |
| Numbers in this document                                           | Copied from CI artifacts of runs 36629764589 and 36631595301 |

Native Chromium in the v0 sandbox lacked system libraries during the historical
baseline work. Remote-browser preview checks are now available, but configured
Docker-backed fixture measurements still run in GitHub CI. Every recorded lab
number here must cite its evidence environment, run URL, and source commit.

## Surfaces

| Id               | URL / flow                        | Data source in CI                                         |
| ---------------- | --------------------------------- | --------------------------------------------------------- |
| `home`           | `/`                               | No-env build: labelled example catalog, local artwork     |
| `explore-empty`  | `/explore`                        | No-env build                                              |
| `explore-search` | `/explore?q=afterglow`            | No-env build                                              |
| `title-detail`   | `/title/afterglow`                | No-env build                                              |
| Save dialog      | Explore discovery card, then Save | `@fixtures`: offline provider fixtures and local Supabase |

**Limitation:** the four page measurements run against the no-env build, so
provider artwork (TMDB, RAWG, and Open Library CDNs) is not part of their
image weight. Provider-artwork behavior is measured on the `@fixtures` Save
flow only. Production image weight can therefore be higher than the lab
figures.

## Methodology

- **Build:** `next build` production output, served with `next start`. The
  `default` project uses the `verify` job's build artifact. `@fixtures` uses
  the Supabase-configured build from `explore-integration`.
- **Browser:** Playwright Chromium, at the Playwright version pinned in
  `package.json` (`@playwright/test` 1.62.1). axe-core 4.12.1 is pinned as a
  dev dependency.
- **Profiles:**
  - Mobile: 390×844 viewport, DPR 3, touch, **4× CPU throttle**, ~150 ms RTT,
    ~1.6 Mbps down / 750 Kbps up. This approximates Lighthouse's mobile preset.
  - Desktop: 1440×900, DPR 1, no throttling.
  - Both use a dark color scheme, and throttling is applied through CDP.
- **Cache:** every run uses a fresh browser context with the HTTP cache
  disabled (`Network.setCacheDisabled`), so all runs are cold. Server-side
  caches, such as the discovery cache and Next's data cache, are **not** reset
  between runs, so runs after the first reflect a warm server.
- **Repetition:** 3 runs per page and profile. The median is reported, and
  every raw run is kept in the JSON attachment.
- **Collected:** TTFB, DOMContentLoaded, load, LCP and its element, and CLS
  (the sum of layout shifts without recent input; not session-windowed, so it
  is conservative). Also script bytes and count, image bytes and count, and
  total bytes. Each image records its rendered width versus natural width
  (an oversize ratio above 2 means it is oversized), `loading`, `fetchpriority`,
  and whether it is in the initial viewport.
- **Accessibility:** an axe scan (WCAG 2.x A/AA rules) per page. The
  tab-order walk records the first stops and the skip link. The Save dialog
  records focus on open, whether focus is trapped under Tab and Shift+Tab, and
  focus restoration after Escape. The reduced-motion check lists animations
  longer than 200 ms while `prefers-reduced-motion: reduce` is set.
- **Gating:** none on values. Specs fail only if a page doesn't render or the
  harness breaks. Timings are compared by a person across commits, never
  against a single-run threshold.

## Reading the evidence

1. Open the CI run for the commit and download `playwright-report` (the page
   baseline) or `playwright-report-fixtures` (the Save dialog).
2. Open `index.html`. Each `quality baseline` or `quality discovery` test has
   a JSON attachment named after its surface and profile.
3. Copy the medians into the results table below, with the run URL and commit.

## Results

Runs:

- **Baseline** — `ac6bf6d` (instrumentation only, no product changes):
  [run 36629764589](https://github.com/jedemarco1030/favalog/actions/runs/36629764589)
- **After fixes** — `1cb5946`:
  [run 36631595301](https://github.com/jedemarco1030/favalog/actions/runs/36631595301)

Medians of 3 cold runs. Axe counts are distinct rule violations per profile
(mobile and desktop were identical in both runs).

| Surface           | Profile | LCP ms (before → after) | CLS (before → after) | Script KB | Image KB | Axe (before → after) |
| ----------------- | ------- | ----------------------- | -------------------- | --------- | -------- | -------------------- |
| `home`            | mobile  | 824 → 824               | 0.0003 → 0.0003      | 169.3     | 2.7      | 2 → 0                |
| `home`            | desktop | 120 → 96                | 0 → 0                | 169.3     | 3.3      | 2 → 0                |
| `explore-empty`   | mobile  | 868 → 836               | 0.0003 → 0.0003      | 179.6     | 0        | 2 → 0                |
| `explore-empty`   | desktop | 132 → 96                | 0.0026 → 0           | 179.6     | 0        | 2 → 0                |
| `explore-search`  | mobile  | 800 → 792               | 0.0009 → 0.0009      | 179.6     | 0        | 2 → 0                |
| `explore-search`  | desktop | 92 → 76                 | 0 → 0                | 179.6     | 0        | 2 → 0                |
| `title-detail`    | mobile  | 804 → 772               | 0.0006 → 0.0006      | 182.5     | 2.0      | 2 → 0                |
| `title-detail`    | desktop | 124 → 104               | 0 → 0                | 182.5     | 2.0      | 2 → 0                |
| Explore discovery | mobile  | 792 → 788               | 0.0001 → 0.0002      | 162.6     | 0.7 → 0  | —                    |
| Explore discovery | desktop | 192 → 192               | **0.0897 → 0**       | 162.6     | 0.7      | —                    |
| Save dialog       | —       | —                       | —                    | —         | —        | 0 → 0                |

### Findings and fixes

- **`color-contrast` (all four pages):** muted text used
  `text-foreground/40`, about 3.3:1 against the background, which is below
  the 4.5:1 AA minimum. Raised to `text-foreground/60` (about 6:1) across the
  affected components; light mode behaves the same way.
- **`aria-prohibited-attr` (Home, title page):** the read-only star rating
  put `aria-label` on a generic `<span>`. It now has `role="img"`, which
  permits the label.
- **`aria-valid-attr-value` (Explore):** the search input's `aria-controls`
  pointed at a results heading that isn't rendered in every state. It now
  points at the results region, and only while a query is active. The region
  falls back to `aria-label` when there's no heading (empty, error, or
  unavailable).
- **Historical Explore discovery desktop CLS 0.0897:** layout-shift attribution
  traced it to catalog browse being pushed down when discovery above it resolved.
  The historical fix moved discovery below the catalog and reported CLS 0.
  That sacrificed discovery-first presentation and is **superseded by PR #21**:
  discovery and downstream catalog share a loading boundary. Do not present
  the historical metric as verification of the restored discovery-first page.
- **Skip link:** a "Skip to content" link was added to the root layout,
  targeting `<main id="main-content">`. It's now the first tab stop on every
  page.
- **Save dialog:** no violations before or after. Focus opens on Close, never
  escapes to a page element (the 2 browser-chrome stops after the last
  control are expected for a native modal `<dialog>`), the create form
  focuses its name field, and Escape returns focus to the trigger.
- **Reduced motion:** no animation longer than 200 ms under
  `prefers-reduced-motion: reduce` on any page.

### Noted, not changed

- Desktop Home and title pages load 150 px avatar SVGs rendered at 28 px
  (oversize ratio 5.36). They are lazy, outside the initial viewport, and
  558 bytes each, and SVG scales without quality loss, so there is no
  meaningful cost to fix.
- LCP differences of 20–40 ms on desktop are within run-to-run noise on a
  shared CI runner and are not claimed as improvements.

## Configured-fixture evidence (CI)

`e2e/quality-configured.spec.ts` runs in the `@fixtures` CI job against the
production build, local Supabase, the offline provider fixtures, and a
signed-in fixture user. Provider artwork is served from two committed fixture
JPEGs (`e2e/fixtures/artwork/`, original abstract images at TMDB w500/w1280
sizes), re-encoded with sharp at each requested width and quality. Byte counts
are therefore representative. Image transfer time, CDN latency, and optimizer
CPU cost are not, because route-fulfilled responses bypass CDP throttling.

| Check                                                                 | Kind                                    |
| --------------------------------------------------------------------- | --------------------------------------- |
| Home, empty Explore, search, title detail perf                        | Recorded, not gated (mobile/desktop)    |
| Save dialog open latency                                              | Recorded, not gated                     |
| 320 px reflow on the same pages                                       | Asserted: no page-level overflow        |
| 200% zoom-equivalent viewport (640 px at 2x; not actual browser zoom) | Asserted: no overflow, submit reachable |
| Reduced motion with the dialog open                                   | Asserted: no motion longer than 10 ms   |
| axe `color-contrast` over fixture artwork                             | Asserted: no violations                 |

Raw JSON is uploaded as `quality-evidence-configured-fixtures`, and
`e2e/portfolio-screenshots.spec.ts` uploads `portfolio-screenshots`. Numbers
are **pending the first CI run on this branch**; none are quoted here until
they come from that artifact. Every Playwright step now writes a JSON report
that `scripts/assert-e2e-results.mjs` checks, so a step that runs zero tests
or skips everything fails instead of passing silently. `@prodreject` now has
its own CI step.

Retry after a failed list add has no browser hook. It's covered by the action
and component tests, not by Playwright.

## Manual checks (not automatable)

- Screen-reader announcement of Save success and error status (VoiceOver and
  NVDA).
- Color contrast of text over artwork. axe reports text on images as
  incomplete rather than passing, so the automated check above catches
  failures it can compute but doesn't prove the hero passes.
