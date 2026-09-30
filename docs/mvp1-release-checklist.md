# MVP 1 release checklist — Phase 4E

**Decision, 2026-09-30: MVP 1 engineering closeout complete; beta acceptance pending these owner checks.**
**MVP 1 NOT ACCEPTED.** Invited beta cannot begin until owner acceptance is
recorded. The checklist below retains migration/deployment, real-account,
manual accessibility and operational gates. The owner merged
[PR #22](https://github.com/jedemarco1030/favalog/pull/22) into `main` at
`f1a392e2d43dad39e690383451b829b77824f361`. No new merge, deployment, hosted
migration/write, user-record deletion, secret change, schedule activation, or
paid embedding invocation is authorized by this checklist.

## Final PR and post-merge verification

[Final PR CI 36771309279](https://github.com/jedemarco1030/favalog/actions/runs/36771309279)
is **completed, success**, application source
`cf82d647d5ccbb685ec5aba25b9c5e48a7ecaa37`. The merged `f1a392e` tree is identical
to that reviewed source. Reports were downloaded and independently summarized;
execution counts are not inferred from green job conclusions.

| Invocation                            |                       First-attempt passes |                            Intentional skips | Retries / flaky |
| ------------------------------------- | -----------------------------------------: | -------------------------------------------: | --------------- |
| Unit/component coverage               |                     1,615 across 166 files |                                            0 | Not Playwright  |
| Strict configured Explore             |                                         15 |                    1 paid live-semantic test | 0 / 0           |
| First-list repetitions                |                          20 + 1 auth setup |                                            0 | 0 / 0           |
| Offline provider fixtures             |                   34, including auth setup |                                            0 | 0 / 0           |
| Slow/partial/empty/disabled discovery | 1 per scenario per viewport; 8 invocations |                                            0 | 0 / 0           |
| Production fixture-refusal            |                                          1 |                                            0 | 0 / 0           |
| Following feed                        |                                          1 |                                            0 | 0 / 0           |
| Likes                                 |                                          1 |                                            0 | 0 / 0           |
| Default no-env                        |                                         44 | 6 existing placeholders/auth-dependent cases | 0 / 0           |
| Explicit no-env                       |                                          5 |                                            0 | 0 / 0           |

Formatting, lint, typecheck, coverage, production/Storybook builds and database
checks passed. pgTAP records **617 tests across 19 files**. Generated types are
byte-identical to the committed file (SHA-256
`72f4b396a36b70146cc61442c0eeb3d61ba695504373e2b644e4c07522020702`).
All E2E invocations have zero failed/invalid tests and zero runner errors.
The configured skip needs real paid-semantic credentials/corpus; the six no-env
skips are four list placeholders plus authenticated deletion/favorites.

Inspected artifacts: `e2e-results-explore-integration`, `e2e-results-social`,
`e2e-results-likes`, `e2e-results-no-env`, `quality-evidence-configured-fixtures`,
`quality-evidence-no-env`, `portfolio-screenshots`, and
`database-types-cf82d647d5ccbb685ec5aba25b9c5e48a7ecaa37`.

[Post-merge main CI 36773633454](https://github.com/jedemarco1030/favalog/actions/runs/36773633454)
is **completed, success** on exact source
`f1a392e2d43dad39e690383451b829b77824f361`. All six jobs passed, including
cleanup and mandatory report/quality/screenshot uploads. Downloaded main
reports independently confirm **every count, skip and zero-retry outcome in
the table above**, not merely equivalent PR job conclusions. Main validation
records 1,615 tests across 166 files and successful formatting/lint/typecheck,
coverage and both builds; database logs record 617 pgTAP tests across 19 files.
Main's generated types are byte-identical to the committed file. The same
artifact names above were inspected from this main run, with generated types
named `database-types-f1a392e2d43dad39e690383451b829b77824f361`.

Main quality evidence confirms Save focus trapping/restoration, zero dialog/form
axe violations or incomplete targets, no 320 px overflow and reduced-motion
maximum duration 0.00001 seconds. Sixteen contrast scans retain ARIA and mobile
Explore contrast incomplete targets; the 640 px report is only a zoom proxy.
Manual screen-reader, actual browser zoom and incomplete-target acceptance are
not automated passes. All ten main desktop/mobile Home, Explore, search,
title and ready Save captures were visually inspected after the capture
harness's image-decode/readiness gates. Retained
[desktop](screenshots/save-dialog-desktop-fixture-main.png) and
[mobile](screenshots/save-dialog-mobile-fixture-main.png) Save captures are
**synthetic local fixture evidence**, not authentic covers or production
portfolio evidence. Genuine-provider captures remain separately dated; the
application `app`, `components`, `lib` and `public` trees are unchanged between
capture source `5847189` and final source `cf82d64`.

This evidence-only documentation update does not change application code,
workflow behavior or schema. Its formatting/diff checks are separate from
the verified main application source. No CI rerun was dispatched to obtain
these results.

The final runner fix reserves ports 54320–54329 before local Supabase image
pulls, preserving existing Linux reservations. Those ports overlap the runner's
ephemeral range, so outbound connections can occupy them before Docker binds.
Startup diagnostics retain listening and non-listening socket owners. This
prevents that allocation race, but does not establish the original failed
listener's identity or prove every possible bind conflict impossible. Explore
prerequisite gating now records setup failures as **tests not executed**, avoids
running dependent suites, and still fails the job; reports remain mandatory
when tests execute. Auth readiness is bounded, local-only and read-only.

Fresh production read-only checks at 942×664 dark found zero local results for
`/explore?q=paper%20watch`; `/title/paper-watch` still resolves with the explicit
Demonstration title notice and no fabricated rating distribution. These are
individual deployed observations, not proof of migration history, complete
search exclusion, exact deployed SHA or authenticated saved-record access.
No hosted write was performed. Owner-controlled migration/deployment status
must be confirmed before beta acceptance.

## Historical inspected post-merge baseline

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

## Follow-up fixes and historical verification limits

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

**The likes startup failure did not recur on the follow-up runner attempt.**
[PR #22 CI 36760089274](https://github.com/jedemarco1030/favalog/actions/runs/36760089274),
source `76bb60866b896d246923932a9bc03e2ba0054814`, successfully started local
Supabase, executed the likes journey, enforced the execution-count gate, uploaded
its JSON report and cleaned up. Following feed also executed successfully.
The original Inbucket `54324` conflict's listener owner was never captured; the
prior requested rerun was denied by GitHub. A fresh successful attempt is evidence
of non-recurrence, not proof of the original owner or a permanent root-cause fix.
Ports, assertions, skips and failure semantics were not relaxed, and no unknown
listener/container was killed. Scoped startup diagnostics remain in every
DB-backed job. Complete Explore evidence was subsequently inspected: this run's overall
conclusion is **failure**, not green. Its configured invocation passed 15 tests
with one intentional paid-semantic skip; first-list passed 20 repetitions plus
one auth setup. Fixtures recorded 22 first-attempt passes, five retry attempts,
one flaky duplicate-save test, one failed materialization test and seven
cascade-skipped tests. Each of eight slow/partial/empty/disabled layout
invocations passed once, and production fixture-refusal passed once.

The materialization failure waited for the obsolete `/title/dune-part-two`
mock slug after correctly navigating to `/title/fixture-dune-part-two`; retries
then could not find the already-imported result. The E2E now asserts the stable
fixture identity and its fixture title instead. The duplicate-save trace
recorded HTTP 200 while waiting for an unrelated RSC page-refresh stream;
existing-list and save-only retries now use the same bounded JSON result
boundary as create-and-save. Authentication, authorization/RLS, safe redirects,
CSRF-origin and request-size checks remain enforced; focused tests cover both
intents, expired auth, rejected origins, body limits and malformed responses.
No timeout, assertion, retry or skip allowlist was relaxed.

Application source `5847189027249bc3a9b939cc490af9c90f4f6340` contains these
regressions' fixes. [CI 36763709617](https://github.com/jedemarco1030/favalog/actions/runs/36763709617)
is **completed, success**. PR jobs use temporary merge `625eac07c507ccac67e45c91846871b03548197f`;
database/type generation checks out the exact application source. Downloaded
JSON reports were inspected, not inferred from job conclusions:

| Invocation                            |                       First-attempt passes |                            Intentional skips | Retries / flaky |
| ------------------------------------- | -----------------------------------------: | -------------------------------------------: | --------------- |
| Unit/component coverage               |                     1,574 across 163 files |                                            0 | Not Playwright  |
| Strict configured Explore             |                                         15 |                    1 paid live-semantic test | 0 / 0           |
| First-list repetitions                |                          20 + 1 auth setup |                                            0 | 0 / 0           |
| Offline provider fixtures             |                   34, including auth setup |                                            0 | 0 / 0           |
| Slow/partial/empty/disabled discovery | 1 per scenario per viewport; 8 invocations |                                            0 | 0 / 0           |
| Production fixture-refusal            |                                          1 |                                            0 | 0 / 0           |
| Following feed                        |                                          1 |                                            0 | 0 / 0           |
| Likes                                 |                                          1 |                                            0 | 0 / 0           |
| Default no-env                        |                                         44 | 6 existing placeholders/auth-dependent cases | 0 / 0           |
| Explicit no-env                       |                                          5 |                                            0 | 0 / 0           |

Formatting, lint, typecheck, coverage, production/Storybook builds, pgTAP/RLS
and generated-type drift passed. The downloaded generated types are byte-identical
to the committed file. Inspected artifacts: `e2e-results-explore-integration`,
`e2e-results-social`, `e2e-results-likes`, `e2e-results-no-env`,
`quality-evidence-configured-fixtures`, `quality-evidence-no-env`,
`portfolio-screenshots`, and `database-types-5847189027249bc3a9b939cc490af9c90f4f6340`.
These results supersede the failed `76bb608` fixture attempt for application
behavior; they do not erase its failures or establish new post-merge main CI.
The final documentation/capture-only source `59368c5b933bfe7b2b606f0b4d161ea4b4d5465d`
failed [CI 36766054279](https://github.com/jedemarco1030/favalog/actions/runs/36766054279).
The production build, schema/RLS, following feed, likes, strict Explore and
20 first-list repetitions passed. After the next local database reset, fixture
Auth setup failed to create its user with an invalid upstream response; all
33 dependent fixture tests, including screenshots, did not run. The missing
`portfolio-screenshots` upload is a downstream failure, not a build error or
proof that screenshots were captured. A bounded, loopback-only, read-only Auth
admin readiness probe now gates both fixture invocations. Artifact requirements,
application assertions and Playwright retries/timeouts remain unchanged. This
readiness change needed fresh CI verification at that point. Final source
`cf82d64` subsequently passed the inspected run recorded above; its new main
run is a separate gate.

Earlier local follow-up checks: 1,562 unit/component tests across 163 files
passed with coverage (93.66% statements, 86.31% branches, 96.20% functions,
94.57% lines); 131 focused catalog/artwork regressions passed, and typecheck
passed. Format, lint and production/Storybook builds passed for that earlier
source. Revised source `5847189` passed formatting, lint and typecheck locally.
Its coverage command reported 1,574 passing tests and the same coverage, then
exited 137 rather than successfully completing. One targeted single-worker
recovery again reported 1,574 passes before exit 137; no further retries were
made. These local coverage invocations are **incomplete**, not clean passes.
The revised-source CI validation job independently completed with 1,574 passes
and successful production/Storybook builds. Docker is absent, so local pgTAP,
type generation and configured/social/likes/fixture E2E could not execute. Native no-env Playwright had five browser-launch
errors and **zero behavior passes**, caused by missing `libnspr4.so`; one
`install-deps` recovery failed because this OS has no `apt-get`. No assertions,
timeouts or skip allowlists were relaxed. Final-source CI was mandatory; the
final PR and post-merge main evidence above now clear that independent gate.

Fresh read-only dark desktop/mobile Home, Explore, search and title checks used
real provider content in the development preview. Final application-source
captures at 942×664 and 390×844 were visually inspected, with required visible
images decoded and no horizontal overflow; the
[quality evidence index](quality/baseline.md#follow-up-source-evidence-2026-09-30)
links the retained `*-provider-preview.png` images. `q=portal` shows genuine
federated TMDB results below the empty local section; missing artwork is honest.
Other search inspection still exposed legacy rows because the hosted migration
is intentionally unapplied: these checks do not prove migrated retrieval.
Authentic production Home captures remain under
`docs/screenshots/home-*-production.png`; production search still showed legacy
titles. A fresh authenticated Save capture requires isolated CI or an
owner-controlled session, not an unauthorized hosted save.

## Remaining engineering and deployment gates

- [x] Open/update [PR #22](https://github.com/jedemarco1030/favalog/pull/22) and
      inspect application source `5847189027249bc3a9b939cc490af9c90f4f6340`.
- [x] Retain a scoped follow-up runner attempt where likes execute and pass
      (`36760089274`); the bind failure did not recur. Original ownership remains
      unknown, so this is not a permanent root-cause-fix claim.
- [x] Review complete final-source PR CI `36771309279` at `cf82d64`, including
      all mandatory invocation counts, 20 retry-free first-list repetitions,
      provider failure scenarios, executed feed/likes, 617 pgTAP tests and
      byte-identical generated types. Post-merge main is inspected separately.
- [x] Fresh application-source desktop/mobile captures for Home, Explore,
      search, genuine-provider title detail and ready Save dialog were visually
      inspected. Provider captures use `5847189`; Save uses its isolated CI
      fixtures, clearly labelled as synthetic test evidence only.
- [x] Owner merged reviewed PR #22 after successful final-source PR CI.
- [x] Verify **new post-merge main CI `36773633454`**, completed success on
      `f1a392e`, and independently inspect all required invocation reports,
      quality evidence, screenshots, pgTAP logs and generated types.
- [ ] Owner confirms whether forward migration
      `20260930180000_separate_demonstration_catalog.sql` is already applied.
      If not, separately approve/apply it after a fresh alias-conflict check,
      then deploy/confirm the reviewed application revision. Never apply
      `seed.sql` to hosted production. Verify exclusion and saved-record access
      before inviting participants. No backfill or identity reconciliation is
      implicitly authorized.

## Browser-only owner acceptance

1. In GitHub Actions, retain final-source PR run `36771309279` and new main
   run `36773633454` with their required reports; the historical failed job does
   not need another rerun to substitute for current evidence. If binding recurs,
   retain scoped socket-owner diagnostics and request a cause-specific fix,
   rather than rerunning until green. Follow the current engineering decision
   above before proceeding.
2. In Supabase Dashboard, confirm the applied-migration history for
   `20260930180000_separate_demonstration_catalog.sql`. If absent, first obtain
   separate migration approval and inspect its exact alias-conflict guard against
   the intended project. Apply only that reviewed forward SQL, never `seed.sql`;
   an alias conflict blocks application and needs separate reconciliation.
   In Vercel's project Deployments, confirm the reviewed main revision is Ready
   after the schema gate. Then, signed out, check Home and
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
5. GitHub **Settings → Environments → catalog-refresh**: the read-only API
   currently reports **no reviewer protections and no branch policy**. Review
   and configure owner-approved protections before rehearsal; verify secret names `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`,
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

The inspected final PR and new post-merge main evidence now support:
**“MVP 1 engineering closeout complete; beta acceptance pending these owner checks.”**
This is not MVP 1 acceptance and does not authorize invitations, hosted writes,
live scheduling, or paid embedding work. Owner acceptance must be explicit.
