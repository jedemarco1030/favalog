# Phase 4E quality baseline

This file records laboratory (lab) measurements. They come from a CI runner
under controlled conditions and are **not** real-user metrics. Real-user
field data comes separately from Vercel Speed Insights (`<SpeedInsights />` in
`app/layout.tsx`) and is not reproduced here. An automated axe scan with no
violations does **not** establish accessibility compliance. It catches only a
subset of issues. Keyboard, focus, and screen-reader behavior are checked
explicitly, and the parts that need a human are listed under "Manual checks".

## Status

| Item                                                               | State                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Harness (`e2e/lib/quality.ts`)                                     | Implemented; typechecked and linted                             |
| Page baseline (`e2e/quality-baseline.spec.ts`)                     | Runs in CI `default` project; **first results pending**         |
| Save-dialog quality (`e2e/quality-discovery.spec.ts`, `@fixtures`) | Runs in CI `explore-integration` job; **first results pending** |
| Numbers in this document                                           | **None yet.** PR 1 results are copied here from CI artifacts    |

The v0 development sandbox cannot launch Chromium (missing system libraries),
so no browser measurement has been run locally. Every number recorded here
must come from a GitHub Actions artifact and cite its run URL and commit.

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

| Commit                 | CI run | Surface | Profile | LCP ms | CLS | Script KB | Image KB | Axe violations |
| ---------------------- | ------ | ------- | ------- | ------ | --- | --------- | -------- | -------------- |
| _pending first CI run_ |        |         |         |        |     |           |          |                |

## Manual checks (not automatable)

- Screen-reader announcement of Save success and error status (VoiceOver and
  NVDA).
- Color contrast of text over artwork in the Home hero (axe can't assess text
  over images).
- 200% zoom and a 320 px reflow on Home and on title pages.
