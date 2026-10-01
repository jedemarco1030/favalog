# MVP 1 release checklist — Phase 4E

**Decision, 2026-09-30: MVP 1 ACCEPTED for an invited beta by the owner against the verified production release.**
Engineering CI, hosted migration and deployment identity are verified as recorded
below. The owner now confirms Steps 3, 4 and 5 and explicitly accepts the three
deferrals below. Owner-reported results are not assistant-observed sessions or
new automated passes. Invitations still require separate approval. This
documentation-only update to PR #24 does not authorize a merge, deployment,
hosted migration/write, user-record change, secret change, schedule activation,
embedding run or invitation.

## Reconciled acceptance record (2026-09-30)

This record reconciles the preceding read-only migration audit, inspected main
CI and the owner's final acceptance supplied for PR #24. The earlier
**not accepted / owner checks pending** decision is superseded by this explicit
owner decision, not rewritten as an assistant-observed pass. Historical
observations below remain dated evidence, not current blockers where superseded.

### Final owner confirmation (reported, not independently observed)

The owner confirms Steps 3, 4 and 5 of the browser-only checklist below:

- Production account, save, persistence, visibility, isolation and social
  journeys behave as expected.
- Manual accessibility checks behave as expected.
- The protected refresh rehearsal completed as expected with `dry_run=true`,
  `limit=1`, the embedding step skipped and live scheduling disabled.

The owner explicitly states: **“I accept MVP 1 for an invited beta against the
verified production release.”** The owner retains RAWG live semantic embeddings,
live scheduled refresh and live semantic-quality evaluation as explicit
deferrals. This is release acceptance of the production identity below, not a
new deployment or approval to send invitations.

No browser/assistive-technology versions, exact announcement text, execution
timestamps, screenshots, refresh run URL or redacted outcome counts were supplied
with this confirmation; none is inferred from prior headless or CI evidence.
These missing detail fields do not negate the owner's confirmation of the steps.
Broad cross-media exclusion has only the recorded direct SQL/search evidence;
no additional assistant-observed sweep is claimed.

### Read-only refresh run lookup

Both `gh run list --workflow catalog-refresh.yml --event workflow_dispatch` and
the workflow-runs API filtered to `workflow_dispatch` returned no matching run
(the API reported `total_count=0`). Accessible recent runs are historical skipped
schedules, not the owner's rehearsal. **Rehearsal completed as owner-reported;
matching run URL and independent GitHub outcome/count evidence unavailable.**
Do not cite a skipped schedule as that rehearsal or call it unperformed. The
owner reports disabled live scheduling; the earlier 403 remains a limit on
independent configuration inspection, not a contradiction of owner confirmation.

- **Reviewed main revision:** `b017f839e12a541278511a5bf69a7240d35fdd8a`, after
  [PR #23](https://github.com/jedemarco1030/favalog/pull/23). Application,
  workflow, script and migration trees are unchanged from `f1a392e`; #23 changed
  documentation and retained screenshots only.
- **Recorded production identity:** <https://favalog.vercel.app>, deployment
  `dpl_Gx3wtzXB1bwvb7DLhVVRWdptKxw8`, **READY**, source SHA matching the reviewed
  revision. Deployment URL:
  <https://favalog-efs150j2r-jedemarco1030s-projects.vercel.app>.
- **Recorded database target:** Vercel production Supabase configuration matches
  connected project ref `bbfutvrzdrutuijmslpl`. No configuration values or
  account details are reproduced here.

### Required gates and evidence limits

| Gate                                            | Recorded result                                                                                                                                                                                                                                                                                  | Acceptance status / remaining evidence                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineering CI                                  | Latest main run `36778248362` passed all six jobs; logs and downloaded invocation reports inspected below.                                                                                                                                                                                       | Satisfied for `b017f83`; skipped tests are not passes.                                                                                                                                                                                                                                                            |
| Hosted migration ledger                         | All 35 migration versions/names match, with no missing/extra entries; `20260930180000_separate_demonstration_catalog.sql` is recorded.                                                                                                                                                           | Satisfied by the preceding read-only audit. Do not reapply or repair it.                                                                                                                                                                                                                                          |
| Installed retrieval/materialization guards      | Keyword, semantic, hybrid and compatible-embedding reads contain the exact legacy exclusion. Materialization has both candidate exclusions and both alias-conflict guards. Zero provider aliases point to the 28 exact legacy identities.                                                        | Satisfied for the inspected definitions/identities, not a live semantic-quality claim.                                                                                                                                                                                                                            |
| Production revision                             | Recorded Ready deployment source equals `b017f839e12a541278511a5bf69a7240d35fdd8a`.                                                                                                                                                                                                              | Deployment identity directly verified; production acceptance now owner-reported against this release.                                                                                                                                                                                                             |
| Demonstration exclusion and saved records       | Production “paper watch” search returns zero local results; `/title/paper-watch` resolves with the demonstration notice. Migration preserves identities/references.                                                                                                                              | Direct exclusion observations retain their limited scope. Owner confirms Step 3 account/save/persistence journeys and accepts this release; no new assistant sweep or authenticated observation claimed.                                                                                                          |
| Authenticated production journeys               | Signed-out Save reaches sign-in with the selected title in `returnTo`.                                                                                                                                                                                                                           | Owner confirms Step 3 production account, save, persistence, visibility, isolation and social journeys behave as expected. Accepted as owner-reported evidence, not inferred from fixtures or directly replayed by the assistant.                                                                                 |
| Manual accessibility and safe failure rehearsal | Automated Linux x86_64 / HeadlessChrome 151.0.0.0; first production Tab reaches the skip link; loaded production Home at 320×800 dark has no page-level overflow. OS distribution/version unavailable; no VoiceOver/NVDA session.                                                                | Owner confirms Step 4 manual accessibility checks behave as expected, accepting its keyboard/dialog, announcements, actual zoom/reflow, contrast/incomplete-target and safe failure checklist. Versions, announcement text and captures not supplied; this is not an assistant-observed or automated manual pass. |
| Protected refresh rehearsal and schedule state  | Owner confirms Step 5 protected rehearsal completed as expected: `dry_run=true`, `limit=1`, embedding step skipped, live scheduling disabled. Read-only matching run lookup returns no run; URL, independent outcome and counts unavailable. Earlier 403/protection observations are historical. | Satisfied for owner acceptance on reported Step 5 results; no independently inspected run or current protection/activation metadata claimed. Dry-run acceptance does not verify live processing or automatic metadata freshness.                                                                                  |
| Owner release decision                          | Owner explicitly accepts MVP 1 for an invited beta against the verified production release, with the three retained deferrals.                                                                                                                                                                   | MVP 1 ACCEPTED on owner-reported Steps 3–5 plus existing verified engineering/hosted evidence. No invitation or operational change authorized.                                                                                                                                                                    |

### Deferrals and user impact

| Item                             | Recorded disposition                                                                                                                              | User impact / release treatment                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RAWG live semantic embeddings    | Explicitly retained by the owner in final beta acceptance. Provider permission unresolved; independent activation still required.                 | Games retain keyword discovery/search only. Fixture semantics are not live RAWG semantic support.                                                                                       |
| Live semantic-quality evaluation | Explicitly retained by the owner pending genuine-provider judgments; fixture golden data refuses paid live evaluation.                            | No live relevance or corpus-completeness acceptance claim. This does not waive normal search or production smoke checks.                                                                |
| Live scheduled refresh           | Explicitly retained by the owner in final beta acceptance; live scheduling disabled as owner-reported. Separate approval required for activation. | Automatic metadata freshness is not yet verified; metadata may become stale. Owner-confirmed dry run is not live scheduled processing. Follow up before separately approved activation. |

The owner has now supplied the required confirmation and explicit release
decision, retaining only the three deferrals above. Their operational/provider
limits and follow-up remain visible; acceptance does not waive them or enable
anything. Missing run links or environment details remain missing evidence,
not invented detail. A 403, skipped job, fixture-only result or viewport proxy
is still never promoted to a direct or automated pass.

## Latest passing main CI — PR #23

[Main CI 36778248362](https://github.com/jedemarco1030/favalog/actions/runs/36778248362)
completed **success** on exact main source
`b017f839e12a541278511a5bf69a7240d35fdd8a` (started 2026-09-30 21:15 UTC).
All six jobs passed, including execution-count gates, required artifact uploads
and local Supabase cleanup. No workflow was dispatched or rerun for this review.

Validation logs record **1,615 tests across 166 files**, formatting, lint,
typecheck, coverage, production build and Storybook build. Database logs record
**617 pgTAP tests across 19 files**. Downloaded generated types are byte-identical
to committed `lib/database.types.ts`, SHA-256
`72f4b396a36b70146cc61442c0eeb3d61ba695504373e2b644e4c07522020702`.

Downloaded `e2e-results-explore-integration`, `e2e-results-social`,
`e2e-results-likes` and `e2e-results-no-env` independently confirm the invocation
counts in the next section's table: configured 15 passes/one paid-semantic skip,
20 first-list repetitions plus auth setup, 34 fixtures including setup, eight
individual provider-layout passes, production fixture-refusal one pass, feed and
likes one pass each, default no-env 44 passes/six skips, explicit no-env five
passes. All executed tests passed first attempt; zero failed/invalid tests,
retries, flaky outcomes or runner errors. Every report identifies `b017f83`.
The six default skips are five list journeys and one favorites journey; they
remain skipped, not authenticated production verification.

Downloaded `quality-evidence-configured-fixtures` confirms Save trapping/focus
restoration and zero dialog/form axe violations or incomplete targets; 320 px
reflow has no overflow on the four inspected pages. `configured-zoom-200.json`
is a **640 px viewport proxy**, not actual browser zoom. Sixteen contrast scans
still contain `aria-prohibited-attr`, `aria-valid-attr-value` and mobile Explore
`color-contrast` incomplete findings. These automated findings remain in the
artifact; manual checklist acceptance is now owner-reported in Step 4, not a
recomputed axe result or fabricated target-by-target report. The
`quality-evidence-no-env` artifact and required `portfolio-screenshots` upload
are present. No new visual-capture or manual accessibility pass is claimed here;
previous genuine-provider and synthetic fixture captures stay separately dated.

## PR #22 and first post-merge verification (historical)

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
skips are five list journeys (including deletion) plus favorites. They are not
executed authenticated checks.

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
ran against source `1c076a3eb4b94672251ca64e6ab33475a4311fe1`, not current
`b017f83`. Its overall conclusion is **failure**,
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
At that earlier capture point, search still exposed legacy rows and migrated
retrieval was unverified. The subsequent read-only audit recorded above confirms
the hosted migration and its installed guards; these earlier images are not
post-migration acceptance evidence. Authentic production Home captures remain
under `docs/screenshots/home-*-production.png`; the earlier production search
inspection showed legacy titles. A fresh authenticated Save capture requires isolated CI or an
owner-controlled session, not an unauthorized hosted save.

## Engineering, deployment and remaining owner gates

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
- [x] Verify first post-merge main CI `36773633454` on `f1a392e` and its
      independent reports/captures (historical evidence above).
- [x] Verify **latest main CI `36778248362`** on `b017f83`; independently inspect
      invocation reports, validation/pgTAP logs, quality evidence and byte-identical
      generated types. Required screenshot upload is present; no fresh manual
      visual or accessibility acceptance is claimed.
- [x] Recorded read-only audit confirms all 35 hosted migration versions/names,
      applied `20260930180000`, installed exclusion/alias-conflict guards and
      zero provider-alias conflicts on the 28 legacy identities. No migration
      application, repair, seed, backfill or identity reconciliation is needed
      or authorized by this documentation PR.
- [x] Recorded production deployment `dpl_Gx3wtzXB1bwvb7DLhVVRWdptKxw8` is
      Ready on reviewed `b017f839e12a541278511a5bf69a7240d35fdd8a`.
- [x] Owner confirms Step 3 production account, save, persistence, visibility,
      isolation and social journeys behave as expected. Direct demonstration
      exclusion observations retain their recorded scope, not a new broad sweep.
- [x] Owner confirms Step 4 manual accessibility checks behave as expected.
      Browser/assistive-technology versions and announcement details were not
      supplied and are not fabricated.
- [x] Owner confirms Step 5 protected refresh rehearsal completed as expected,
      `dry_run=true`, `limit=1`, embedding step skipped, live scheduling disabled.
      Matching run link and independent outcome/count evidence remain unavailable.
- [x] Owner explicitly retains RAWG live semantic embeddings, live scheduled
      refresh and live semantic-quality evaluation as beta deferrals, with
      limitations and follow-up recorded above.
- [x] Owner explicitly accepts MVP 1 for an invited beta against the verified
      production revision. No new release/deployment is created by this decision.
- [ ] Obtain separate invitation approval before contacting participants; no
      invitations are authorized or sent under this PR.

## Browser-only owner acceptance

This reference checklist preserves the scope used for owner acceptance. The
owner now confirms Steps 3, 4 and 5 and explicitly accepts the verified release
with the three deferrals above. Retained instructions below are not fresh pending
gates or authorization to repeat account writes or hosted workflow operations
under this PR. Step 2's direct evidence remains limited to the recorded audit/
search/route observations; final acceptance is the owner's release decision.

1. Retain latest main run `36778248362` on reviewed `b017f83` and its required
   reports, plus historical PR/main runs `36771309279` / `36773633454`. Existing
   evidence has been inspected; no rerun is needed to replace a historical
   failure. If binding recurs in future CI, retain scoped socket-owner diagnostics
   and request a cause-specific fix rather than rerunning until green.
2. Use the recorded applied-migration and Ready deployment identity above;
   **do not reapply the migration or redeploy as part of this reconciliation**.
   If the owner later observes target/revision drift, stop for a new review;
   never apply `seed.sql` to production or repair/reconcile identities implicitly.
   Complete broad signed-out Home/Explore discovery checks across media types:
   real TMDB/Open Library/RAWG search, attribution, counts/filters/page URLs and
   artwork. Paper Watch/Under the Eaves must not appear as ordinary production
   results. Then use an owner-controlled authenticated session to verify existing
   saved legacy records still resolve and retain their references/labels; the
   public `/title/paper-watch` observation alone does not satisfy that check.
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
5. GitHub **Settings → Environments → catalog-refresh**: before the owner's
   final confirmation, the read-only API reported **no reviewer protections and
   no branch policy**. The owner now confirms the protected rehearsal completed
   as expected; current protections were not independently re-inspected. Reference
   procedure: review owner-approved protections and verify secret names
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`,
   `TMDB_API_READ_TOKEN`; do not share their values. Ensure the URL's project ref
   matches the intended project. Keep `CATALOG_REFRESH_ENABLED` unset/`false`.
   **Actions → Catalog metadata refresh → Run workflow → branch `main` after
   the approved merge → dry_run=true (checked) → limit=1**. Approve the protected
   environment if asked. Expect `event=workflow_dispatch dry_run=true limit=1`,
   successful provider reads, zero database/embedding writes and **Bounded
   stale-embedding backfill skipped**. Record redacted checked/changed/unchanged/
   failed/unavailable counts (at most one checked row). `checked=0` proves only a
   no-work rehearsal, not metadata processing. Do not run `dry_run=false`.
6. Record results or explicit reviewed deferrals for every required gate, using
   the reviewer/date, scope, reason, user-impact, mitigation and follow-up fields
   above. Record an explicit owner release decision against the reviewed/deployed
   revision. Only after acceptance **and separate invitation approval** use the
   [invited-beta checklist](beta/invited-beta-checklist.md).

Historical direct refresh observations: the latest five accessible scheduled
runs were **skipped**; newest
[36702695138](https://github.com/jedemarco1030/favalog/actions/runs/36702695138).
The earlier activation-variable 403 limited independent inspection; skipped runs
alone did not prove a disabled flag. These are not the owner's protected
rehearsal. That rehearsal is now **completed as owner-reported**, with
`dry_run=true`, `limit=1`, embedding step skipped and live scheduling disabled.
The matching run URL and independent GitHub outcome/count evidence are
unavailable in the read-only lookup. No checked-row count, zero-write log or
live processing outcome is invented. A dry run does not verify automatic
metadata freshness. GitHub Actions configuration is separate from Vercel Vars.
Live scheduling and embedding work remain deferred and require separate approval;
RAWG remains keyword discovery/search only until permission **and** independent
activation are verified.

Latest main CI and recorded migration/deployment evidence, together with final
owner-reported Steps 3–5 and the three explicit owner-retained deferrals, support:
**“MVP 1 ACCEPTED by the owner for an invited beta against the verified production release.”**
The prior pending decision is superseded. This is not permission to merge,
deploy, change hosted data, activate scheduling, run embeddings or send
invitations. No such operation was performed by this documentation update.
