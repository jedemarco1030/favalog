# MVP 1 release checklist — Phase 4E

**Decision: NOT ACCEPTED yet.** PR [#21](https://github.com/jedemarco1030/favalog/pull/21)
is a closeout candidate, not permission to merge, deploy, mutate hosted data,
enable scheduled writes, or invite beta participants. Owner checks and
final-commit artifact review remain release gates.

## Evidence ledger

- Reviewed baseline: `main` at `5d1663b`, PR #20,
  [CI 36661125887](https://github.com/jedemarco1030/favalog/actions/runs/36661125887).
  Fixtures: 28 first-attempt passes, one first-list create/save flaky pass on
  retry. The failed attempt's error context remained in “Saving”; only the
  successful retry trace was retained. That does **not** identify a cause.
- Candidate application/test/workflow source: `629fa3a`,
  [CI 36664561980](https://github.com/jedemarco1030/favalog/actions/runs/36664561980).
  Twenty retry-free first-list repetitions all failed: some reproduced the
  original pending-save stall; the others reached success and failed a newly
  added title-link assertion that expected the wrong accessible name. The
  assertion now targets the exact title link within List contents. Failed
  first-attempt traces are retained. The candidate fix performs create/save in
  one authenticated Server Action response, keeping a created list available
  for save-only retry on partial failure; verification is still pending.
  Final execution counts, retries, decoded screenshots, and raw measurements
  must be inspected before this ledger can be marked complete.
- Source `3bc4561`, [CI 36666650203](https://github.com/jedemarco1030/favalog/actions/runs/36666650203):
  twenty retry-free first-list attempts executed, **all failed**. Seven retained
  the pending “Saving” stall even with a single Server Action; thirteen reached
  server-confirmed success, persisted one title after refresh, then failed a
  page-wide uniqueness assertion because the same public list appears in both
  Your lists and Community lists. The assertion now scopes to Your lists.
  The next candidate returns create/save through an authenticated, same-origin,
  bounded JSON endpoint, independently of streamed RSC refresh completion.
  Existing write authorization/RLS and save-only partial-failure retry remain.
  This candidate is **not yet browser-verified**; combining Server Actions alone
  did not fix the stall and must not be reported as the final root cause/fix.
- Source `3bc4561` passed format, lint, typecheck, all 1,503 unit/component tests
  with coverage (93.66% statements, 86.28% branches, 96.19% functions, 94.57%
  lines), production build, Storybook, pgTAP and generated-type drift checks.
  The JSON-boundary candidate additionally passes 43 focused route/client/action/
  component tests, format, lint and typecheck; its full CI remains required.
  Docker is unavailable in the v0 sandbox; isolated E2E, pgTAP, production and
  Storybook builds are delegated to GitHub CI.
- Default no-env candidate run: 44 first-attempt passes, six intentional skips;
  no-env-specific run: five passes. The default execution gate initially failed
  because four pre-existing `test.fixme` list placeholders were not allow-listed.
  The correction names all six exact exceptions; it does not permit new skips.
  Four are real-list placeholders; two need authenticated deletion/favorites.
  Isolated fixtures exercise list creation/visibility; authenticated production
  deletion/favorites still require owner confirmation, not a claimed no-env pass.
- Read-only v0 development preview: 942×664 dark desktop and 390×844 dark
  mobile screenshots inspected; four provider shelves precede the local catalog,
  mobile document width equals viewport (390 px). One unthrottled development
  navigation at 390×844 observed CLS 0, TTFB 701 ms, LCP 1,364 ms. This uses live
  provider reads and warm/unspecified caches, **not** production or fixture
  performance evidence, and establishes no improvement.
- No final release/production performance or screen-reader pass is asserted.

## Functional acceptance

Mark a row complete only after its cited CI evidence and required owner smoke
check exist. Fixtures validate behavior, not hosted provider state.

- [ ] Empty-query Home/Explore discovery across films, TV, books, games;
      provider-ranked labels, media filters, discover sort/page URLs, and
      clearly identified local catalog below discovery.
- [ ] Known-title search across TMDB, Open Library, and RAWG; local exact-title
      protection and keyword fallback. RAWG live embeddings remain blocked.
- [ ] Open/materialize/save a canonical title; existing-list save and first-list
      create/save; exactly one list/item, server-confirmed success, refresh
      persistence, and duplicate prevention.
- [ ] Retry failed add without creating another list; safe sign-in continuation
      and account isolation. Component/action failure injection is separate
      from the browser journey and must not be described as browser proof.
- [ ] Auth/onboarding, diary/reviews/favorites, account switching; follows,
      following feed, review/list likes, visibility revocation and RLS.
- [ ] Slow provider, partial failure, empty results, and providers disabled:
      no demo records presented as live, no excessive reserved holes; mandatory
      TMDB/RAWG attribution and safe artwork fallbacks remain visible.
- [ ] Fully rendered screenshot and configured quality artifacts: discovery
      present, required images decoded, intended materialized title, ready dialog.
      Mobile and desktop captures inspected and useful examples committed.
- [ ] Each Playwright invocation reports nonzero required execution; unexpected
      skips, unusable reports and failures fail the gate. Retries/flaky results
      are exposed; retry-free first-list repetitions precede the full suite.

## Accessibility acceptance

CI covers keyboard trapping, Escape/focus restoration, create/save live
regions, 320 px reflow, a 640 px/2x **zoom-equivalent viewport**, reduced motion,
and dark/light axe violations plus incomplete/manual-review findings. This
is not a screen-reader, real-browser-zoom, or compliance certification.

Owner: use VoiceOver + Safari or NVDA + Firefox/Chrome. Record date, OS,
browser, assistive-technology version, each result, and any actual announcement
(text or a paraphrase). Do not include account names or email addresses.

- [ ] Navigate Home → Explore by keyboard; skip link enters main, every visible
      focus is discernible. Find provider shelves, search, filters, and title
      links by headings/landmarks; no disappearing discovery sections.
- [ ] Activate Save on a provider card. Expect “Save [title]” dialog, then Close
      or List name focus (zero-list user); Tab/Shift+Tab stays within it.
      Escape restores the invoking Save control.
- [ ] Create an empty/invalid list: expect native required-field validation or
      associated list-name error and error announcement, not silent failure.
- [ ] Create/save a valid list: expect “Created [list] and saved [title]” status
      announcement. Activate View list; refresh retains one title. Repeat save:
      expect “[title] is already in [list]”, with no duplicate item.
- [ ] In a controlled nonproduction failure rehearsal, create list then fail
      add: expect “Created [list], but [title] wasn't saved yet” plus the safe
      error. Retry Save without another list. Do not disrupt production just
      to induce this state; report unavailable if no safe setup exists.
- [ ] At **actual 200% browser zoom**, content and dialog submit stay reachable;
      separately review 320 px viewport, reduced motion, and light/dark text
      contrast including text over artwork. Review every axe incomplete target.

Send the results to the PR before final acceptance; none are automatically
checked by this document.

## Operational acceptance

Latest observed scheduled refresh:
[36557022714](https://github.com/jedemarco1030/favalog/actions/runs/36557022714),
**skipped**. Five latest observed scheduled runs skipped. This establishes no
metadata processing. Actions configuration listing returned HTTP 403; required
configuration could not be verified. No hosted dry-run or activation was done.

Owner dashboard steps:

1. GitHub repository **Settings → Environments → catalog-refresh**: confirm
   branch/reviewer protections and secret **names** `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`, `TMDB_API_READ_TOKEN`.
   Never paste values into the PR. Confirm URL project ref exactly matches
   `SUPABASE_PROJECT_REF` and is the intended production project.
2. **Settings → Secrets and variables → Actions → Variables** (and environment
   variables): inspect `CATALOG_REFRESH_ENABLED`. Keep unset/`false` while
   rehearsing. Vercel Vars do not configure GitHub Actions.
3. **Actions → Catalog metadata refresh → Run workflow**, select the reviewed
   branch, leave **dry_run checked (`true`)**, set **limit `1`**. Approve its
   protected environment if requested. Verify `Report run mode` says
   `event=workflow_dispatch dry_run=true limit=1`, provider refresh succeeded,
   and **Bounded stale-embedding backfill is skipped**. Record run URL and
   redacted counts. `checked=0` proves only a write-free invocation, not refresh.
4. [ ] Confirm bounded provider reads and no database/embedding writes from
       that run. If no due rows exist, document that limitation rather than claim
       metadata changed. Review the rollout runbook before any separate live test.
5. Scheduled writes require **separate explicit owner approval**. Review the
   workflow first: daily 04:17 UTC, up to 200 metadata rows and a separate
   embedding backfill of up to 200 rows with TMDB eligibility enabled inline.
   A manual live metadata limit of `1` does **not** narrow the embedding batch.
   Do not run `dry_run=false` as part of this acceptance rehearsal.
6. Only after approval and budget/target verification, set the GitHub variable
   to literal `true`; observe an actual completed scheduled job and redacted
   checked/changed/unchanged/unavailable/failed/remaining-due summary. A skipped
   or zero-work run is not evidence of successful metadata refresh.
7. Rollback: set/delete `CATALOG_REFRESH_ENABLED` to disable future schedules;
   use **Actions → run → Cancel workflow** for queued/running work if required.
   The concurrency group does not automatically cancel an in-flight run.
   Preserve existing records; no destructive cleanup or credential changes.

[Rollout runbook](tmdb-activation-rollout.md) ·
[Scheduler handoff](ci/catalog-refresh-scheduler-handoff.md).
RAWG permission and live embedding activation remain independently unresolved;
this closeout does not change their gates or run a paid backfill.

## Final production smoke test (owner, after approved deployment)

1. Signed out: Home/Explore shows provider discovery first; filter all four
   media types, search a known title, check attribution and a title page.
2. Sign in from Save and verify same-card continuation. Save into an existing
   list, create a first/new list, refresh, repeat save, check one item/list.
3. Switch accounts; prior private lists and ownership controls do not leak.
   Follow/unfollow, feed, review/list likes, and revoke follower-only visibility.
4. Check narrow/mobile plus desktop light/dark, keyboard/Escape, actual zoom,
   announcements, and a provider-unavailable fallback without demo leakage.
5. Confirm operational run URL/target/mode and RAWG gate unchanged. Record
   owner acceptance only once every required release row is satisfied.

Then use the existing [invited-beta task script and anonymous feedback template](beta/invited-beta-checklist.md).
It does not authorize invitations or analytics; keep participant notes private.
No invented user counts, revenue, relevance, or production-performance claims.
