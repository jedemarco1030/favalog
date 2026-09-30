# MVP 1 release checklist — Phase 4E

**Decision, 2026-09-30: engineering closeout INCOMPLETE; MVP 1 NOT ACCEPTED.**
Invited beta cannot begin yet. This follow-up starts from merged PR
[#21](https://github.com/jedemarco1030/favalog/pull/21), `main` at
`1c076a3eb4b94672251ca64e6ab33475a4311fe1`. No merge, deployment, hosted
migration/write, user-record deletion, secret change, schedule activation, or
paid embedding invocation is authorized by this checklist.

## Inspected post-merge baseline

[CI 36749917450](https://github.com/jedemarco1030/favalog/actions/runs/36749917450)
ran against the exact main source above. Its overall conclusion is **failure**,
not green: likes failed during Supabase startup, before Playwright executed.
Downloaded JSON artifacts were inspected separately from job conclusions.

| Invocation                            |                       First-attempt passes |         Intentional skips | Retries / flaky  | Result                                                                                  |
| ------------------------------------- | -----------------------------------------: | ------------------------: | ---------------- | --------------------------------------------------------------------------------------- |
| Unit/component coverage               |                                      1,522 |                         0 | Not Playwright   | Passed                                                                                  |
| Strict configured Explore             |                                         14 |                         1 | 0 / 0            | Passed; paid live semantic test requires real credentials/corpus and was not run        |
| First-list repetitions                |                          20 + 1 auth setup |                         0 | 0 / 0            | All 20 journey repetitions passed                                                       |
| Offline provider fixtures             |                 34, including 1 auth setup |                         0 | 0 / 0            | Passed                                                                                  |
| Slow/partial/empty/disabled discovery | 1 per scenario per viewport; 8 invocations |                         0 | 0 / 0            | Passed                                                                                  |
| Production fixture-refusal            |                                          1 |                         0 | 0 / 0            | Passed                                                                                  |
| Following feed                        |                                          1 |                         0 | 0 / 0            | Passed                                                                                  |
| Likes                                 |                                          0 | Setup prevented execution | No test attempts | Failed setup                                                                            |
| Default no-env                        |                                         44 |                         6 | 0 / 0            | Passed; four existing list placeholders and two auth-dependent deletion/favorites cases |
| Explicit no-env                       |                                          5 |                         0 | 0 / 0            | Passed                                                                                  |

Formatting, lint, typecheck, production/Storybook builds, pgTAP and generated-type
drift passed on that baseline. These are **not** final-source verification for
this follow-up.

Inspected artifacts: `e2e-results-explore-integration`, `e2e-results-social`,
`e2e-results-no-env`, `quality-evidence-configured-fixtures`, and
`portfolio-screenshots`. Representative fixture Explore/title/Save captures were
reviewed visually. The title capture still showed demonstration recommendations;
the catalog capture still included legacy examples. Those are defects, not
acceptable portfolio representations. Fixture images are synthetic, never
credible evidence of authentic covers. Historical failed candidates
`629fa3a`, `3bc4561`, and `04e957a` predate this inspected main run; their pending
first-list claims are superseded by the baseline above, not by a final-source pass.

## Follow-up fixes and current limits

- Exact `source=favalog` plus the 28 immutable legacy identifiers distinguishes
  demonstrations from genuine internal curation. Home and browse apply the
  exclusion before genre facets, pagination and exact counts.
- Forward migration `20260930180000_separate_demonstration_catalog.sql` excludes
  those identities from keyword, semantic, hybrid and compatible-corpus reads.
  It preserves return signatures, rank/cutoff logic, grants and removal filters.
  No stored media, user references, slugs, IDs, ratings or aliases are rewritten.
- Deterministic title matching cannot link a real provider title to a demo. Exact
  alias conflicts fail safely rather than silently detaching or merging them.
  The hosted read-only check found **zero** aliases on these identities; the
  migration independently refuses unexpected conflicts at application time.
- Configured title pages and metadata resolve the database first, never the mock
  catalog. Saved demonstration routes remain available and labelled. Synthetic
  rating distributions and mock related-title recommendations render only in the
  labelled no-env experience. Provider attribution remains intact.
- Real artwork is preserved; missing covers get a compact typographic fallback.
  Title backdrops use the approved artwork boundary and failure fallback;
  synthetic bundled images cannot become title backdrops or Open Graph covers.
  Unused title sidebar space and raw provider-subject genre clutter are removed.
- Embedding selection skips legacy demos. The existing synthetic evaluation
  dataset now targets distinct **local-only** search fixtures. `eval:search --live`
  fails before paid calls until a genuine-provider judgment dataset is reviewed.
  This is an explicit tooling deferral; normal genuine-provider search is not
  disabled. No live semantic-quality or corpus-completeness claim is made.
- Every database-backed CI job now logs scoped port-owner diagnostics around
  startup. Likes/feed report prerequisite failure as **tests not executed**;
  reports remain mandatory when their test step runs. Cleanup remains limited to
  this local Supabase project. No listener/container is indiscriminately killed.

**Likes infrastructure is NOT yet resolved.** The historical failure is an
Inbucket bind conflict on host port `54324`; the owner of that listener was not
captured. One requested rerun was denied by GitHub (`Resource not accessible by
integration`). A transient or recurrent cause therefore cannot be asserted.
Do not change ports, suppress failures, disable likes, or repeatedly rerun until
green. The next runner attempt must retain the new listener/container diagnostics.

Local follow-up checks: 1,562 unit/component tests across 163 files passed with
coverage (93.66% statements, 86.31% branches, 96.20% functions, 94.57% lines);
131 focused catalog/artwork regressions passed, and typecheck passed. Format,
lint and production/Storybook builds passed. The first full-coverage invocation
did not yield a completed result; the bounded-worker invocation above did.
Docker is absent, so local pgTAP, type generation and configured/social/likes/
fixture E2E could not execute. Native no-env Playwright had five browser-launch
errors and **zero behavior passes**, caused by missing `libnspr4.so`; one
`install-deps` recovery failed because this OS has no `apt-get`. No assertions,
timeouts or skip allowlists were relaxed. Final-source CI remains mandatory.

Fresh read-only dark desktop/mobile Home, Explore, search and title checks used
real provider content in the development preview. Search still exposed legacy
rows because the hosted migration is intentionally unapplied: these checks do
not prove migrated retrieval. Authentic production Home captures are committed
under `docs/screenshots/home-*-production.png`; production search still showed
legacy titles. A fresh authenticated Save capture requires isolated CI or an
owner-controlled session, not an unauthorized hosted save.

## Remaining engineering and deployment gates

- [ ] Open/update the follow-up review PR and inspect the exact source SHA.
- [ ] Resolve or demonstrate the transient likes startup cause with one retained
      runner attempt; verify likes actually execute and pass.
- [ ] Review complete final-source CI, including all mandatory invocation counts,
      first-list repetitions without retries, provider failure scenarios, feed,
      likes, pgTAP and generated types. Signatures/types are unchanged by the
      migration, but drift must still be checked rather than assumed.
- [ ] Fresh final-source desktop/mobile captures for Home, Explore, search,
      genuine-provider title detail and ready Save dialog; required images decode.
      Inspect them visually; synthetic fixtures remain test evidence only.
- [ ] Owner reviews and merges only after engineering gates pass. Verify the
      **new post-merge main CI**, not merely PR CI, before the release decision.
- [ ] Owner separately approves/applies the forward migration after a fresh
      alias-conflict check, then deploys the reviewed application. Never apply
      `seed.sql` to hosted production. Verify exclusion and saved-record access
      before inviting participants. No backfill or identity reconciliation is
      implicitly authorized.

## Browser-only owner acceptance

1. In GitHub Actions, open the failed baseline likes job and **Re-run failed
   jobs once** if still appropriate. On the review PR, inspect all final-source
   jobs and artifacts; if binding recurs, retain the port-owner diagnostics and
   request a cause-specific fix. After merge, verify the new main CI run.
2. Following separate migration/deployment approval: signed out, check Home and
   Explore discovery first across all media types; search real TMDB/Open Library/
   RAWG titles, inspect attribution, counts/filters/page URLs and artwork. Paper
   Watch/Under the Eaves must not appear as ordinary production results. A saved
   legacy title route must still resolve with its demonstration indication.
3. With owner-controlled accounts, check Save sign-in continuation, first/new/
   existing-list save, refresh and duplicate prevention; check diary/reviews/
   favorites, account isolation, follow/unfollow/feed, review/list likes and
   follower-only visibility revocation. Record URLs/results without personal data.
4. Keyboard and assistive technology: check skip link, headings/landmarks, visible
   focus, Save dialog Tab/Shift+Tab trap, Escape restoration, invalid-list error,
   success/already-saved announcements and save-only retry in a safe nonproduction
   failure rehearsal. Record VoiceOver/Safari or NVDA/browser versions and actual
   announcements. Check **actual 200% browser zoom**, 320 px reflow, reduced
   motion and light/dark artwork contrast. Review axe incomplete targets.
5. GitHub **Settings → Environments → catalog-refresh**: inspect protections and
   secret names `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`,
   `TMDB_API_READ_TOKEN`; do not share their values. Ensure the URL's project ref
   matches the intended project. Keep `CATALOG_REFRESH_ENABLED` unset/`false`.
   **Actions → Catalog metadata refresh → Run workflow → branch `main` after
   the approved merge → dry_run=true (checked) → limit=1**. Approve the protected
   environment if asked. Expect `event=workflow_dispatch dry_run=true limit=1`,
   successful provider reads, zero database/embedding writes and **Bounded
   stale-embedding backfill skipped**. Record redacted checked/changed/unchanged/
   failed/unavailable counts (at most one checked row). `checked=0` proves only a
   no-work rehearsal, not metadata processing. Do not run `dry_run=false`.
6. Record explicit owner acceptance in the PR. Only after all required evidence
   exists use the [invited-beta checklist](beta/invited-beta-checklist.md).

Latest five observed scheduled refresh runs were **skipped**; newest
[36702695138](https://github.com/jedemarco1030/favalog/actions/runs/36702695138).
Scheduling is not operationally verified, and no protected hosted dry run was
performed here. GitHub Actions configuration is separate from Vercel Vars.
Live scheduling and paid embedding work require separate approval. RAWG remains
keyword discovery/search only until permission **and** independent activation
are verified. Optional deferral must be owner-recorded with user impact, never
silently converted into a passed release gate.

When engineering gates actually pass but owner acceptance remains, use exactly:
**“MVP 1 engineering closeout complete; beta acceptance pending these owner checks.”**
That decision is **not yet supported** by the current evidence.
