# Phase 4E quality baseline

This file records laboratory (lab) measurements. They come from a CI runner
under controlled conditions and are **not** real-user metrics. Real-user
field data comes separately from Vercel Speed Insights (`<SpeedInsights />` in
`app/layout.tsx`) and is not reproduced here. An automated axe scan with no
violations does **not** establish accessibility compliance. It catches only a
subset of issues. Keyboard, focus, and screen-reader behavior are checked
explicitly, and the parts that need a human are listed under "Manual checks".

## Current inspected closeout evidence (2026-09-30)

[Final PR CI 36771309279](https://github.com/jedemarco1030/favalog/actions/runs/36771309279)
completed successfully on application source
`cf82d647d5ccbb685ec5aba25b9c5e48a7ecaa37`. The owner merged PR #22 into
`f1a392e2d43dad39e690383451b829b77824f361` with an identical tree; the distinct
[post-merge main run](https://github.com/jedemarco1030/favalog/actions/runs/36773633454)
is **completed, success**. Its separately downloaded invocation reports,
quality JSON and all ten desktop/mobile fixture captures were inspected.
Every count/skip/zero-retry outcome below is confirmed independently on main,
not inferred from the identical source tree or PR results. Main generated types
match the committed file; validation and database logs confirm the test counts.
The authoritative decision is **MVP 1 engineering closeout complete; beta
acceptance pending these owner checks**, detailed in the
[release checklist](../mvp1-release-checklist.md#final-pr-and-post-merge-verification).

Retained main ready Save captures:
[desktop](../screenshots/save-dialog-desktop-fixture-main.png) and
[mobile](../screenshots/save-dialog-mobile-fixture-main.png), exact main source
`f1a392e`, 1280×800 and 390×844, synthetic offline fixture artwork/content.
These do not show genuine provider covers or establish hosted Save acceptance.
The genuine-provider captures below retain source `5847189`; its application
`app`/`components`/`lib`/`public` trees match final `cf82d64` byte-for-byte.

The final PR and main reports were independently inspected: 1,615
unit/component passes across 166 files, 617 pgTAP passes across 19 files,
byte-identical generated types, 34 offline fixtures, 20 first-list repetitions
plus auth setup, configured Explore 15 passes/one paid-semantic skip, eight
separate provider-layout passes, production fixture-refusal one pass, and
likes/feed one pass each. Default no-env has 44 passes/six intentional skips;
explicit no-env has five passes. No E2E retries, flaky outcomes, unexpected
skips, failures, invalid tests or runner errors occurred.

Final PR configured quality evidence retains zero page-focus escapes, initial
Close focus, create-name input focus and Escape restoration. Save dialog/form
axe violation and incomplete arrays are empty. All four surfaces have 320 px
reflow without overflow; reduced-motion maximum duration is 0.00001 seconds.
The 640 px report is still **viewport equivalence, not actual 200% browser
zoom**. Sixteen theme/viewport/surface contrast checks retain ARIA and mobile
Explore contrast incomplete targets; zero violations does not establish
compliance. Manual screen-reader announcements, actual browser zoom and
incomplete-target acceptance remain owner gates. Fixture performance is
laboratory evidence, never production speed.

Final-source fixture title/Explore/Save captures were visually inspected.
Explore's similarly named catalog examples are distinct `test-fixture:`
identities added only by local `seed.sql`, not preserved historical records or
production data. This is synthetic test evidence, not a portfolio of authentic
covers. The genuine-provider captures linked below remain separately labelled
with their original source/environment; no hosted save was performed.
Fresh read-only production checks found no local Paper Watch search result and
an accessible `/title/paper-watch` with its demonstration notice. These narrow
checks do not establish migration history, deployed SHA, full retrieval
exclusion or authenticated owner access.

### Historical baseline and local verification limits

Source `1c076a3eb4b94672251ca64e6ab33475a4311fe1`,
[post-merge CI 36749917450](https://github.com/jedemarco1030/favalog/actions/runs/36749917450):
34 offline fixture passes and 20 retry-free first-list passes (plus auth setup),
with no fixture skips/retries/flaky outcomes. This supersedes older pending
first-list claims, but not the unresolved likes startup or final-source gates.

Downloaded `quality-evidence-configured-fixtures` was inspected: configured
Explore-mobile measurements contain three samples and explicitly identify a
production build served locally with offline providers and synthetic artwork.
They are not production performance. The dialog report records initial Close
focus, create-form input focus, no escaped application focus stops, focus
restoration, and zero dialog/create-form axe violations or incomplete findings.
`configured-zoom-200.json` records 640 px viewport/scrollWidth without offenders
on all four surfaces: **viewport equivalence only, not actual browser zoom**.

`configured-contrast.json` still contains incomplete `aria-prohibited-attr`,
`aria-valid-attr-value` and `color-contrast` findings, including Home `.pt-6`,
menu `aria-controls` targets and mobile navigation links. They are retained
for review, not counted as passes. Manual VoiceOver/NVDA announcements, actual
browser zoom and artwork contrast acceptance remain required.

Representative main fixture title/Explore/Save screenshots were visually
inspected. The title still included legacy demonstration recommendations and
Explore still exposed legacy catalog examples; these captures are rejected as
current portfolio evidence. Fresh genuine production Home captures at 1280×900
and 390×844 are committed separately, dated 2026-09-30 and labelled as the
**deployed baseline**, not the unapplied follow-up. Development preview captures
covered Home, Explore, search and a genuine Open Library title at 942×664 and
390×844 with visible images decoded; search exclusion is not established before
the owner applies the new migration. Authenticated Save capture requires CI or
an owner-controlled session, not a hosted mutation during read-only inspection.

Earlier follow-up local coverage: 1,562 passes across 163 files, 93.66%
statements, 86.31% branches, 96.20% functions, 94.57% lines. Revised `5847189`
local coverage reported 1,574 passing tests with the same coverage, but exited
137; one single-worker recovery also exited 137 after reporting all passes.
Neither invocation is a clean completed check. Formatting/lint/typecheck passed
locally; revised-source CI independently completed 1,574 tests and both builds.
Native no-env Playwright reported
five browser-launch failures and no behavior passes (`libnspr4.so` absent).
One dependency-recovery attempt failed because `apt-get` is unavailable. Docker
is also absent: final-source pgTAP/type-drift and configured fixtures/social/likes
are not verified locally. See the [release checklist](../mvp1-release-checklist.md)
for current per-invocation counts, owner steps and the release decision.

## Follow-up source evidence (2026-09-30)

[PR #22 CI 36760089274](https://github.com/jedemarco1030/favalog/actions/runs/36760089274)
uses application source `76bb60866b896d246923932a9bc03e2ba0054814`. The database
job checks out that exact SHA. Other PR jobs exercise GitHub's temporary merge
`1c0ebde696dcc614fe659ccc7f9c4e494da0725a` into baseline `1c076a3`; this is not
a new post-merge main run. Source formatting, lint, typecheck, coverage and
production/Storybook builds passed, as did pgTAP and generated-type drift.
The downloaded `database-types-76bb60866b896d246923932a9bc03e2ba0054814`
artifact is byte-identical to the committed types.

Downloaded `e2e-results-no-env` confirms default 44 first-attempt passes and
six intentional no-auth/list skips; explicit no-env confirms five passes.
Both have zero retries/flaky outcomes. The exact skip allowlist was checked,
not inferred from green job status. `quality-evidence-no-env` Home reports zero
axe violations, a retained incomplete `aria-valid-attr-value` finding on the
menu button, a skip link and no long animations under reduced motion.
These are no-env laboratory observations, not production accessibility or
performance certification. Likes and following feed executed successfully.
Complete configured artifacts were subsequently inspected: this run **failed**.
Configured Explore passed 15 tests with one intentional paid-semantic skip;
first-list passed 20 journey repetitions plus one auth setup without retries.
Fixtures had 22 first-attempt passes, five retry attempts, one flaky duplicate
save, one failed materialization and seven cascade skips. All eight separate
slow/partial/empty/disabled desktop/mobile invocations passed once without
retries; production fixture-refusal passed once. Do not count the failed
fixture invocation as 34 clean passes.

The materialization assertion targeted an obsolete mock slug despite successful
navigation to the correct fixture slug. The duplicate-save trace had HTTP 200
but stalled behind an unrelated streamed page refresh. Application source
`5847189027249bc3a9b939cc490af9c90f4f6340` corrects the fixture identity assertion
and routes existing-list/save-only results through bounded, authenticated JSON,
matching create-and-save without weakening assertions or timeouts.
[CI 36763709617](https://github.com/jedemarco1030/favalog/actions/runs/36763709617)
completed successfully, including all E2E jobs. The revised-source invocation
reports are detailed below. This is not final documentation-branch or post-merge
acceptance.

Inspected configured quality artifacts from the failed `76bb608` run remain
valid only for their individual checks: `a11y-save-dialog.json` reports initial
Close focus, zero page-focus escapes, two native browser-chrome stops, name-input
focus on create and Escape restoration; dialog/create-form axe violations and
incomplete lists are empty. `configured-reflow-320.json` and
`configured-zoom-200.json` report no overflow. The latter is a **640 px layout
proxy**, not actual 200% browser zoom. Reduced-motion findings are laboratory
checks, not screen-reader acceptance. The 16 surface/theme/viewport contrast
checks report zero violations but retain incomplete `aria-prohibited-attr` on
Home's `.pt-6`, `aria-valid-attr-value` on closed-menu `aria-controls`, and
`color-contrast` on mobile Explore navigation. Review these targets manually;
none is silently counted as passed accessibility compliance.

Genuine-provider development-preview screenshots were visually inspected at
942×664 and 390×844 after required visible images decoded and fonts settled.
All four surfaces have viewport-equal scroll widths (942/390 px):

| Surface | Desktop                                                        | Mobile                                                        | Observed content                                                                       |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Home    | [Capture](../screenshots/home-desktop-provider-preview.png)    | [Capture](../screenshots/home-mobile-provider-preview.png)    | Genuine RAWG hero, provider shelves                                                    |
| Explore | [Capture](../screenshots/explore-desktop-provider-preview.png) | [Capture](../screenshots/explore-mobile-provider-preview.png) | Genuine TMDB discovery artwork                                                         |
| Search  | [Capture](../screenshots/search-desktop-provider-preview.png)  | [Capture](../screenshots/search-mobile-provider-preview.png)  | `q=portal`, scrolled to genuine TMDB results; missing artwork intentionally falls back |
| Title   | [Capture](../screenshots/title-desktop-provider-preview.png)   | [Capture](../screenshots/title-mobile-provider-preview.png)   | `/title/dune`, genuine Open Library cover, Fiction/Science Fiction labels              |

Search had zero local matches and genuine federated results below the empty
local section; these captures do not claim local corpus completeness. They use
the unchanged hosted schema: migrated search exclusion and actual browser zoom
are not established. No hosted saves/writes were performed. Authenticated Save
captures belong to isolated CI fixtures or an owner-controlled session.

## Revised source evidence (2026-09-30)

[CI 36763709617](https://github.com/jedemarco1030/favalog/actions/runs/36763709617)
uses application source `5847189027249bc3a9b939cc490af9c90f4f6340` and temporary
PR merge `625eac07c507ccac67e45c91846871b03548197f`, not post-merge main.
The validation job completed 1,574 tests across 163 files with coverage and
production/Storybook builds. Database/RLS and generated-type drift passed; the
downloaded `database-types-5847189027249bc3a9b939cc490af9c90f4f6340` has SHA-256
`72f4b396a36b70146cc61442c0eeb3d61ba695504373e2b644e4c07522020702`, matching
the committed file byte-for-byte.

Downloaded and inspected `e2e-results-social` and `e2e-results-likes` each contain
one first-attempt pass with no skips, retries or flaky outcomes; the repository's
execution gate was run against both reports. `e2e-results-no-env` contains 44
first-attempt default passes with six intentional skips (four existing list
placeholders, authenticated list deletion and favorites), and five explicit
no-env passes without skips. Both have zero retries/flaky outcomes and the skip
names were checked. `quality-evidence-no-env` again reports no Home violations,
retains the closed-menu ARIA incomplete target, confirms the skip link and no
long reduced-motion animations. Complete `e2e-results-explore-integration`
inspection confirms configured 15 passes/one intentional paid-semantic skip,
first-list 20 repetitions plus auth setup, fixtures 34 passes, production
fixture-refusal one pass, and eight independent slow/partial/empty/disabled
layout passes. Every invocation has zero retries, flaky outcomes, unexpected
skips, failures, invalid attempts or top-level errors. The overall run is
completed **success**.

Revised-source configured quality reports again confirm no Save-dialog
page-focus escapes, create-name focus and Escape restoration, no dialog/form
axe violations or incomplete findings, no 320 px overflow and reduced motion
with maximum duration 0.00001 seconds. The 640 px zoom proxy is still **not**
actual browser zoom. All 16 surface/theme/viewport contrast reports have zero
violations but retain ARIA and mobile Explore contrast incomplete targets in
`configured-contrast.json`; owner screen-reader, real zoom and incomplete-target
acceptance is required.

The exact-source `portfolio-screenshots` ready Save dialog was visually inspected
at 1280×800 and 390×844: populated list choices, create-list option, selected-list
state and enabled Save button are visible without clipping. Retained
[desktop](../screenshots/save-dialog-desktop-fixture-followup.png) and
[mobile](../screenshots/save-dialog-mobile-fixture-followup.png) captures use
**synthetic offline fixture content/artwork**, not authentic covers or production
portfolio evidence. The final documentation/capture-only branch update still
needs its own CI review; no post-merge main verification is implied.

All eight Home/Explore/search/title provider-preview captures above were
refreshed on application source `5847189` at 942×664 and 390×844, after fonts
settled and visible genuine RAWG/TMDB/Open Library artwork was ready. They were
visually inspected, including Explore's Save entry points and search's honest
missing-artwork fallback. Explore and desktop title scroll widths were measured
as viewport-equal. These are development-preview/read-only captures, not proof
of the unapplied hosted retrieval migration or authenticated Save success. A fresh read-only 942×664 dark preview check
clicked a genuine TMDB title's Save link and reached the sign-in page with a
same-origin `/explore?save=tmdb:movie:…` continuation. No account sign-in or hosted save was attempted. Authenticated
success/duplicate behavior requires the isolated fixture reports and owner
acceptance, not this signed-out navigation check.

## Historical status

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
signed-in fixture user. Artwork is served from two committed synthetic
photographs (`e2e/fixtures/artwork/`, at TMDB w500/w1280 sizes), re-encoded with
sharp at each requested width and quality. Fixture routing also substitutes
these photographs for local demo SVG posters/backdrops so selected captures
are artwork-backed throughout; production artwork and domain data are unchanged.
They are not authentic covers for any displayed title. Byte counts model these
fixture assets, not a particular production catalog. Image transfer time, CDN latency, and optimizer
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
`e2e/portfolio-screenshots.spec.ts` uploads `portfolio-screenshots`. Candidate
run 36664561980 produced layout-scenario evidence, but failed retry-free saves
before full fixture capture; it is not a complete release evidence run.
Its web-server health probe warmed discovery, so its slow-scenario medians do
**not** establish a cold delayed-provider navigation. The corrected harness
probes sign-in (no discovery), isolates server cache keys by scenario/profile,
records `settledMs`, and requires the first slow sample to include the 2000 ms
provider delay. Later repetitions remain warm-server samples, not cold ones.

Each Playwright invocation writes its own JSON report checked by
`scripts/assert-e2e-results.mjs`: no usable execution, missing required specs,
failures and unexpected skips fail. Default no-env has six exactly named
pre-existing exceptions; the configured semantic live-OpenAI journey is the
one configured exception. Retries/flaky results are exposed separately, and
first-list/layout repetitions require zero retries. `@prodreject`, social,
and likes have separate execution gates. Required quality/screenshot artifact
checks fail if evidence is missing. See the [release ledger](../mvp1-release-checklist.md)
for inspected source/run results rather than obsolete “first run pending” claims.

Inspected Home desktop/mobile screenshots from source `3bc4561`, run
36666650203, are committed in `docs/screenshots/` and embedded in README/case
study. Explore/title captures from that run were rejected for local demo
placeholder cards; fresh corrected captures remain required. The zoom-equivalent
check failed at empty Explore because no artwork intersected the 400 px-high
viewport, not because an image failed to load. Accessibility scans now load and
decode all main artwork before scanning. Performance still observes initial
viewport images from navigation start; no scroll or eager-image rewrite is
introduced into measured runs. These differing readiness modes must not be
compared as a performance improvement.

Retry after a failed list add has no browser hook. It's covered by the action
and component tests, not by Playwright.

### Closeout discovery scenarios — source `3bc4561`

The `playwright-report-layout-scenarios` artifact from
[CI 36666650203](https://github.com/jedemarco1030/favalog/actions/runs/36666650203)
was downloaded and its eight embedded reports inspected. All eight invocations
executed once, passed without skips/retries, and retained three raw navigation
samples. Chromium uses the profiles above: mobile 390×844/3x, 4x CPU, 150 ms
latency and 1.6 Mbps down; desktop 1440×900/1x, unthrottled. Browser caches are
disabled; only the first sample has a cold scenario/profile server cache.

| Scenario                      | Mobile CLS samples     | Desktop CLS samples | Mobile settled ms samples | Desktop settled ms samples |
| ----------------------------- | ---------------------- | ------------------- | ------------------------- | -------------------------- |
| Slow (2000 ms provider delay) | 0.0003, 0.0004, 0.0004 | 0, 0, 0             | 3477, 3029, 3134          | 2560, 858, 522             |
| Partial provider failure      | 0.0004, 0.0004, 0.0004 | 0.0026, 0, 0        | 3213, 3124, 3094          | 981, 922, 1026             |
| Empty shelves                 | 0.0005, 0.0005, 0.0005 | 0.0026, 0.0026, 0   | 2843, 2792, 2757          | 564, 399, 454              |
| Providers disabled            | 0.0005, 0.0005, 0.0005 | 0.0026, 0, 0        | 2795, 2735, 2747          | 521, 577, 626              |

The cold slow samples include the provider delay; low warm desktop medians
must not hide that wait. Discovery remains before the catalog, and the tests
assert that loading space disappears after empty/disabled results, the failed
book shelf disappears without removing films, and no editorial examples leak.
The shared loading boundary trades immediate catalog visibility for a stable,
discovery-first reveal. Layout-shift observation starts before navigation, not
after readiness. Nonzero desktop shifts are attributed to header search/auth
controls, not shelves pushing down the catalog. This is lab evidence from local
Supabase and offline providers, **not a comparable performance improvement**
or live-production/CDN evidence. Route-fulfilled artwork bypasses real image
latency and optimizer cost.

### Closeout no-env inspection — source `3bc4561`

[CI 36666650203](https://github.com/jedemarco1030/favalog/actions/runs/36666650203)
completed the default/no-env job. Downloaded JSON records 44 first-attempt
passes and six narrowly allow-listed skips for `default`, and five first-attempt
passes with no skips for `no-env`. Both report zero flaky or unexpected results.
The separate following-feed and likes jobs each report one first-attempt pass,
zero skips and zero flaky results. This does not establish configured provider
presentation, production behavior, or completion of the still-running Explore job.

[Committed no-env raw samples and axe findings](evidence/3bc4561/no-env/) retain
all three navigations per surface/profile. Empty Explore measured median CLS
0.0003 on mobile and 0 on desktop, with **zero artwork bytes**. This is the
no-provider configuration and must not be substituted for artwork-heavy fixture
or live-production evidence. No comparable improvement is claimed.

All four no-env surfaces report no axe violations, but **not zero incomplete
findings**: the collapsed theme popup produces `aria-valid-attr-value` manual
review on both profiles, and mobile Home also reports `color-contrast` review
for the active navigation link and icon-only Search control. A read-only
942×664 dark development-preview check confirmed that opening the theme popup
creates the referenced `role="menu"` target and Escape restores trigger focus.
This explains that relationship, not a screen-reader pass or clearance of the
contrast findings. Review all remaining artwork-backed incomplete targets and
perform the owner checks in the release checklist.

## Manual checks (not automatable)

- Screen-reader announcement of Save success and error status (VoiceOver and
  NVDA).
- Color contrast of text over artwork. axe reports text on images as
  incomplete rather than passing, so the automated check above catches
  failures it can compute but doesn't prove the hero passes.
