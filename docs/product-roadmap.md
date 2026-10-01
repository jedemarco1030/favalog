# Favalog product roadmap

> Living document. Last reconciled: 2026-09-30 (Phase 4E closeout), against
> post-merge `main` at `b017f83` (merged PR #23). Latest main CI and recorded
> hosted migration/deployment identity are verified in
> [the release checklist](mvp1-release-checklist.md#reconciled-acceptance-record-2026-09-30).
> MVP 1 is **not accepted**: authenticated production/saved-record, manual
> accessibility and operational owner checks remain open, not silently deferred.
> Update this file whenever a phase
> ships, a capability becomes production-verified, or the agreed sequence
> changes. When a statement is only true at a point in time, keep it and date it
> rather than deleting the history.

## Current closeout evidence (2026-09-30)

After merged [PR #23](https://github.com/jedemarco1030/favalog/pull/23),
[latest main CI 36778248362](https://github.com/jedemarco1030/favalog/actions/runs/36778248362)
completed successfully on `b017f839e12a541278511a5bf69a7240d35fdd8a`.
Inspected logs and downloaded reports confirm **1,615 unit/component tests
across 166 files**, **617 pgTAP tests across 19 files**, byte-identical generated
types, 34 first-attempt fixtures, 20 first-list repetitions plus auth setup,
configured Explore 15 passes/one paid-semantic skip, eight provider-layout
passes, production fixture-refusal one pass, feed/likes one pass each, default
no-env 44 passes/six skips and explicit no-env five passes. Zero executed E2E
failures, retries, flaky outcomes or runner errors; all six jobs, formatting,
lint, typecheck, coverage and both builds passed. Skips remain skips.

**MVP 1 engineering closeout complete; MVP 1 NOT ACCEPTED.** The preceding
read-only migration/acceptance record supplies the hosted results below, not a
new authenticated session or signed owner release decision. The
[release checklist](mvp1-release-checklist.md#reconciled-acceptance-record-2026-09-30)
records full evidence, limits, blockers and deferral treatment.

| Current capability / gate                          | Evidence                                                                                                                                                                                           | Release status                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineering closeout                               | Latest main CI `36778248362`; required execution reports and quality artifacts inspected.                                                                                                          | Verified for `b017f83`, not production owner acceptance.                                                                                                                           |
| Hosted migration and project identity              | All 35 versions/names match; Vercel production config matches connected Supabase ref. `20260930180000` is recorded, exclusions/alias guards installed, zero aliases on 28 exact legacy identities. | Verified by preceding read-only audit; not pending application.                                                                                                                    |
| Production deployment                              | `dpl_Gx3wtzXB1bwvb7DLhVVRWdptKxw8` Ready on exact reviewed `b017f83`.                                                                                                                              | Deployment identity verified; authenticated smoke still pending.                                                                                                                   |
| Demonstration separation and saved records         | “paper watch” has zero local production search results; labelled `/title/paper-watch` still resolves; migration preserves identities/references.                                                   | Partial production observation; broad exclusion and authenticated existing-record access remain open.                                                                              |
| Save and personal/social journeys                  | Signed-out Save retains selected title in sign-in `returnTo`; local fixture/feed/likes and RLS tests pass.                                                                                         | Fresh authenticated continuation, list saves/duplicates/refresh, cross-media, two-account isolation, visibility/revocation, feed/likes and diary/reviews/favorites still required. |
| Accessibility and safe partial failure             | CI Save focus/axe and 320 px reflow checks pass; recorded production skip link and 320 px Home check.                                                                                              | No screen-reader announcements or actual 200% zoom; light/dark contrast, axe incomplete targets, other narrow surfaces and safe nonproduction failure rehearsal remain open.       |
| Catalog refresh                                    | Recorded five skipped schedules; no manual-dispatch rehearsal; no reviewer/branch protections at inspection; activation-variable read 403.                                                         | No processing or verified-disabled flag claim. Protected `dry_run=true`, `limit=1` rehearsal, schedule-state confirmation and owner review remain required.                        |
| RAWG semantic embeddings / live quality evaluation | RAWG permission unresolved; genuine-provider evaluation judgments pending.                                                                                                                         | Documented scope/tooling deferrals: keyword-only games and no live relevance/corpus-completeness claim.                                                                            |

Intentional live-scheduling deferral still needs owner confirmation with user
impact (unverified automatic freshness); it is not inferred from a skipped run
or this task's no-activation constraint. No remaining account, accessibility or
operational gate has a reviewed release waiver. Acceptance requires recorded
results or explicit owner-reviewed deferrals (reviewer/date, scope, reason,
impact, mitigation, follow-up), followed by an explicit release decision.
Nothing here authorizes invitations, deployment, hosted writes, scheduling or
embedding runs.

### PR #22 evidence before the hosted audit

The owner merged [PR #22](https://github.com/jedemarco1030/favalog/pull/22),
final source `cf82d647d5ccbb685ec5aba25b9c5e48a7ecaa37`, into main
`f1a392e2d43dad39e690383451b829b77824f361` with an identical tree.
[Final PR CI 36771309279](https://github.com/jedemarco1030/favalog/actions/runs/36771309279)
and [first main CI 36773633454](https://github.com/jedemarco1030/favalog/actions/runs/36773633454)
passed; their separately inspected reports confirm the counts above. Main
`b017f83` leaves application, workflow, script and migration trees unchanged;
#23 added documentation and retained screenshots. The CI fix reserves local
Supabase ports before image pulls and gates dependent suites on successful
setup without relaxing tests, artifacts, assertions, retries or timeouts.
Original historical socket ownership remains unknown.

### Historical candidates and baseline

[Post-merge CI 36749917450](https://github.com/jedemarco1030/favalog/actions/runs/36749917450)
ran source `1c076a3eb4b94672251ca64e6ab33475a4311fe1`: 20 retry-free first-list
journeys plus auth setup, 34 first-attempt fixtures, configured Explore 14 passes
and one paid-semantic skip, following feed one pass. Database/type-drift and
validation/build jobs passed. Likes failed during local Inbucket binding on
54324, before Playwright; the overall run failed. A single requested rerun was
denied by GitHub permissions, so the conflict is not yet classified as transient.

[PR #22](https://github.com/jedemarco1030/favalog/pull/22), application source
`76bb60866b896d246923932a9bc03e2ba0054814`, separates the exact historical
demonstration identities without rewriting user references, fixes mock-first
title rendering and safe artwork fallbacks, and captures scoped CI startup
diagnostics. [Follow-up CI 36760089274](https://github.com/jedemarco1030/favalog/actions/runs/36760089274)
passed source validation/builds and database/type drift; likes and following
feed executed successfully. The historical bind failure did not recur on that
attempt, but its original listener owner remains unknown. Complete artifacts
show that this run nevertheless **failed**: configured Explore passed 15 plus
one paid-semantic skip; first-list passed 20 repetitions plus auth setup without
retries, while fixtures had five retries, one flaky duplicate-save, one failed
materialization and seven cascade skips. All eight isolated provider-layout
scenarios and production fixture-refusal passed. Source `5847189` fixes the
obsolete materialization slug assertion and duplicate-save result's dependency
on streamed RSC refresh. Its [CI 36763709617](https://github.com/jedemarco1030/favalog/actions/runs/36763709617)
completed successfully: 1,574 unit/component tests across 163 files, configured
15 passes/one paid-semantic skip, 20 first-list repetitions plus auth setup,
34 fixtures, eight independent provider-layout passes, production fixture-refusal
one pass, following feed one pass and likes one pass. All executed E2E tests
passed on their first attempt, with zero retries/flaky outcomes. Default no-env
has 44 passes/six intentional skips; explicit no-env has five passes/no skips.
Builds, pgTAP/RLS and generated-type drift passed; generated types are
byte-identical. Fresh genuine-provider Home/Explore/search/title screenshots and
ready fixture Save captures were inspected. At that point final
workflow/documentation-branch and post-merge main CI remained required;
current source evidence is recorded above. No hosted write was performed here.
Earlier local verification: 1,562 unit/component passes and 131 focused regressions;
Docker and native Playwright remain unavailable in this sandbox, not in CI.
The full [release checklist](mvp1-release-checklist.md) is authoritative.

The five latest inspected refresh schedules skipped; newest
[36702695138](https://github.com/jedemarco1030/favalog/actions/runs/36702695138).
No protected hosted rehearsal or live schedule activation is claimed. RAWG
remains keyword-only; permission and separate live embedding activation are
still unresolved. The fixture-only golden dataset cannot be used to claim
live semantic quality; a genuine-provider evaluation dataset is an explicit
operator-tooling deferral, not a waiver of required beta checks.

## Historical status reconciliation (2026-09-29)

This dated section is superseded by the current closeout evidence above.
It preserves historical capability labels rather than asserting final-source
or release acceptance. A claim gets only the labels it has evidence for:

- **Implemented**: the code is on `main`.
- **CI-verified**: a job in `.github/workflows/ci.yml` exercises it.
- **Owner-confirmed**: the owner reported the behavior working in hosted
  production.
- **Unverified / deferred**: none of the above, or intentionally not built.

Committed files are never taken as evidence of hosted flags, scheduler
activation, or database state.

| Capability                                                                        | Implemented                    | CI-verified                                                                            | Owner-confirmed in production                                                             |
| --------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Auth, onboarding, diary, reviews, lists, favorites, profiles (real Supabase)      | Yes                            | Unit, pgTAP, Playwright                                                                | Yes (2026-09-01 baseline)                                                                 |
| Follows, follower-only lists, following feed, likes                               | Yes                            | pgTAP, `social` / `likes` Playwright                                                   | Yes (2026-09-25)                                                                          |
| Hybrid search (full-text + pgvector) with Open Library federation                 | Yes                            | Unit, pgTAP, `eval:search` fixtures                                                    | Yes (2026-09-01)                                                                          |
| TMDB movie/TV discovery, search, import, title pages                              | Yes                            | Unit, `@fixtures` Playwright (offline fixture server)                                  | Yes (2026-09-21)                                                                          |
| Games via RAWG: discovery, import, keyword search, attribution                    | Yes (PR #11, #13)              | Unit, pgTAP (`game_media_and_status.test.sql`)                                         | Preview-verified 2026-09-25; production discovery included in the 2026-09-29 confirmation |
| RAWG **live semantic embedding**                                                  | Implemented; gated off in code | Fixture tests (Vitest and pgTAP) with `--fake` vectors only                            | **Deferred**: RAWG permission unresolved. Not enabled, backfilled, or production-verified |
| Phase 4D discovery shelves, artwork fallback, related titles, save from discovery | Yes (PR #13, #14)              | Unit, component                                                                        | Yes (2026-09-29)                                                                          |
| Create a new list inside the Save dialog (new and existing-list users)            | Yes (PR #15)                   | Component tests and isolated `@fixtures` CI; PR #20 had one retried first-list journey | Yes (2026-09-29); retry-free closeout evidence still required                             |
| `catalog-refresh.yml` workflow                                                    | Yes, on `main` since `7486441` | Worker logic unit-tested; latest scheduled run `36557022714` skipped                   | **Not operationally verified**: skipped jobs prove no metadata processing                 |

**CI reconciliation (2026-09-29).** Contrary to the earlier status text,
`@fixtures`, `social`, `likes`, and following-feed jobs already exist and ran
in [baseline run 36661125887](https://github.com/jedemarco1030/favalog/actions/runs/36661125887).
The fixture report recorded 28 first-attempt passes and one flaky/retried
first-list journey, not 29 equivalent first-attempt passes. PR #21 adds
per-invocation execution gates, retained failed-attempt traces, retry-free
save repetitions, and artwork/readiness requirements. Its inspected results
and remaining acceptance gates belong in the
[release checklist](mvp1-release-checklist.md). No hosted activation is inferred
from code or passing fixture CI.

## Product vision

Favalog is a social entertainment platform for tracking, rating, reviewing,
organizing, and discovering movies, television, books, and video games. Over
time a person's Favalog becomes a living record of the entertainment and
interests they love. Movies, TV, books, and games are media types inside shared
experiences — a single cross-media diary, list, review, favorite, and discovery surface — **not**
separate top-level products.

The visual direction is dark-first, premium, editorial, cinematic, social,
content-first, and artwork-forward: restrained violet/coral accents, warm
off-white typography, subtle borders and motion. Favalog deliberately avoids
SaaS-dashboard, admin-panel, and generic component-library aesthetics, and does
not imitate Letterboxd or Goodreads directly.

### Target user

The primary user is an enthusiast who consumes across media types and wants one
honest, personal, cross-media record instead of separate movie / TV / book
silos — someone who values a tasteful, editorial reading and browsing
experience and eventually a social layer built around that record.

## Verified production baseline (2026-09-01)

These facts are the source of truth for reconciling other documentation. The
counts and migration-ledger observations below are point-in-time evidence
recorded on **2026-09-01**, not current measurements; where a number differs
between the local repository and hosted production, both are stated explicitly.

- The hosted database had all **25 migrations through `20260815120600`** applied
  in the **2026-09-01 migration-ledger observation**.
- The **local** curated catalog migration
  (`20260806160100_catalog_media_items.sql`) owned **28** curated titles in the
  **2026-09-01 repository observation**.
- The **hosted production** catalog contained **29** titles in the
  **2026-09-01 production observation**: the 28 curated
  titles plus the imported Open Library Work `OL893414W`, which resolves to the
  canonical **Dune** title via on-demand materialization.
- The compatible OpenAI embedding corpus in production contained **29** documents
  in that **2026-09-01 production observation**
  (provider `openai`, model `text-embedding-3-small`, `dimensions: 512`,
  document version `v1`).
- Open Library federation and canonical on-demand materialization are
  **enabled and production-verified**.
- Hybrid semantic search is **production-active and verified**; `OL893414W`
  participates in it.
- `TMDB_ENABLED` remains **false** in production (search and import) and must
  stay disabled until the owner confirms AI-use permission from TMDB.
- Authentication, diary entries, lists, favorites, profiles, and external
  materialization all use real Supabase persistence.

### Owner-provided TMDB clarification

The owner has provided evidence that TMDB staff support periodically refreshed
cached metadata and embeddings for semantic search. This is architectural
context for those specific uses, not blanket approval or activation permission
for Favalog. As of the **TMDB activation-readiness** work below, the refresh
implementation is no longer deferred — it is implemented and locally verified —
but **TMDB activation itself remains pending**: `TMDB_ENABLED` remains **false**
in hosted production and no provider flags, hosted secrets, or schedules are
changed by this work. Turning it on is the owner-controlled procedure in
[`docs/tmdb-activation-rollout.md`](tmdb-activation-rollout.md).

## TMDB activation milestone — owner-confirmed production behavior (2026-09-21)

On **2026-09-21** the owner confirmed, from hosted production, that TMDB
activation setup is complete and the user-facing behavior below works. These are
**owner-confirmed UI observations**, deliberately kept distinct from the
workflow/processing evidence recorded further down:

- TMDB movie and TV titles appear in production discovery/search.
- Movies and TV shows can be added to lists.
- Title pages (`/title/[slug]`) open without errors.

The TMDB provider environment variables (`TMDB_API_READ_TOKEN`,
`TMDB_EMBEDDING_ENABLED`, `TMDB_ENABLED`) are present in the project
environment. For **discovery and import specifically**, this supersedes the
earlier "`TMDB_ENABLED` remains false" baseline; earlier dated statements are
retained as history rather than rewritten.

**Scheduled-refresh workflow verification — pending (2026-09-21).** A read-only
GitHub Actions inspection on this date, against `main` (`5fc96e0a`), found:

- The `catalog-refresh` workflow **does not exist on `main`**. The only
  registered workflow is `CI` (`.github/workflows/ci.yml`); a
  `workflows`-scoped maintainer has not yet added
  `.github/workflows/catalog-refresh.yml`.
- Consequently **no manual (`workflow_dispatch`) refresh/embedding run and no
  scheduled run have ever executed**, so there is no run summary demonstrating
  actual processing (checked/changed/unchanged) — only the absence of runs.
- Scheduling is therefore **not enabled**, and the manual-refresh, scheduled-run,
  and "actual processing" verifications remain **pending** until the workflow is
  installed and exercised per the
  [scheduler handoff](ci/catalog-refresh-scheduler-handoff.md) and
  [rollout runbook](tmdb-activation-rollout.md).

Catalog and compatible-embedding counts were **not** re-measured on 2026-09-21;
the historical **2026-09-01** figures (29 titles / 29 compatible embedding
documents) stand as the last measured observation and are not restated as
current.

## TMDB activation readiness & periodic metadata refresh (implemented locally)

**Status: implemented locally and verifiable on seeded local Supabase with
deterministic provider fixtures; NOT activated in hosted production.** This work
prepares Favalog to safely activate movie/TV discovery and imports, keep
imported provider metadata fresh, and regenerate affected embeddings while
preserving users' records.

What is implemented:

- **Reconciled provider gating & attribution.** Obsolete unconditional
  "permission pending" restrictions are replaced with the documented activation
  requirements. Default and unconfigured environments stay disabled; TMDB
  credentials remain server-only; disabled/unconfigured TMDB makes no request;
  provider failures never break local catalog or Open Library results.
- **Canonical identity preserved.** Movie and TV records with the same numeric
  TMDB id stay distinct; repeated/concurrent imports resolve to one canonical
  row; refresh preserves media id, slug, aliases, and all diary/review/list/
  favorite references; only provider-owned metadata is refreshed; curated rows
  linked to a provider alias are not overwritten.
- **Bounded periodic refresh worker** (`scripts/refresh-catalog.mjs` +
  tested `scripts/refresh-catalog-core.ts`, migrations
  `20260815120700_refresh_external_media_provider_metadata.sql` and
  `20260815121000_external_media_refresh_lifecycle.sql`): deterministic bounded
  batches, oldest-checked-first, resumable, with timeouts, bounded concurrency,
  per-run limits, bounded retries/backoff honoring `429`/`Retry-After`, a
  configurable **7-day engineering-default** freshness target with daily checks,
  successful-check vs. content-change tracking, a write-free dry-run mode, and
  the preserved remote-write guard. Authoritative removals are handled
  separately from transient outages.
- **Embedding consistency.** Changed metadata refreshes the canonical document
  and invalidates the stale embedding so an older-hash vector is never served as
  current; only eligible missing/stale embeddings are regenerated via the
  existing bounded tooling; poster-only/timestamp changes do not churn
  embeddings; embedding failure preserves keyword search and leaves the row
  retry-eligible.
- **Executable scheduler** delivered as an applyable, owner-gated GitHub Actions
  workflow (see [scheduler handoff](ci/catalog-refresh-scheduler-handoff.md)):
  manual dispatch + daily schedule, a `CATALOG_REFRESH_ENABLED` activation
  variable defaulting to disabled, protected secrets + explicit target project,
  minimal permissions, overlap prevention, and bounded refresh followed by
  bounded stale-embedding backfill.

Deliberately not built: TMDB activation in production, a bulk catalog clone, new
media types, episode tracking, generative AI, or any hosted mutation. The exact
owner-controlled activation procedure and disable/recovery steps live in
[`docs/tmdb-activation-rollout.md`](tmdb-activation-rollout.md).

## Current production capabilities

- **Identity & onboarding** — sign in/up, email confirmation, password reset,
  optional Google OAuth, session-aware shell, `/onboarding`, all via SSR cookies
  (`@supabase/ssr`) with the security model documented in ADR 0002.
- **Diary lifecycle (create / edit / delete)** — real per-user diary entries and
  optional linked reviews, persisted through atomic `SECURITY INVOKER` RPCs
  scoped to `auth.uid()`.
- **Lists lifecycle** — create / add-title / remove-title / edit metadata /
  delete, with globally unique immutable slugs and RLS-backed visibility.
- **Favorites lifecycle** — idempotent favorite / unfavorite with server-ordered
  positions, public-read profiles.
- **Follow lifecycle & follower-only lists (Phase 4B.1)** — atomic idempotent
  `public.set_follow` (`SECURITY INVOKER`, transaction advisory lock serialization)
  enables follow/unfollow by canonical username, live follower/following profile counts,
  and follower-aware Row Level Security on lists and list items (`public`, `followers`, `private`).
  Unfollowing immediately revokes access to follower-only lists.
- **Phase 4B.1 production verification (owner-confirmed)** — the complete flow
  was verified in production: community list → creator profile → follow →
  follower-only list access → unfollow → the list disappears and its direct URL
  becomes inaccessible. The creator-navigation patch used by this flow was also
  production-verified.
- **Real profiles** — derived stats, recently watched/read, real reviews, real
  lists and favorites; mock demo usernames still render mock profiles, unknown
  usernames `notFound()`, and a real profile never inherits mock data.
- **AI Discovery v1 — hybrid catalog retrieval (not generative)** — `/explore`
  fuses Postgres full-text search and pgvector cosine via Reciprocal-Rank Fusion
  with exact-title protection and a semantic relevance cutoff; provenance-guarded,
  killable, and degrading safely to keyword-only. Production-active and verified.
- **Catalog Platform v1A/v1B — external ingestion & federated discovery** —
  provider-neutral ingestion (`lib/catalog/`), canonical-identity aliasing
  (`media_external_ids`), federated Explore sections, and trusted on-demand
  materialization. Open Library is enabled and production-verified. TMDB was
  gated off until 2026-09-21, and its discovery and import are now
  owner-confirmed in production (see the TMDB activation milestone). RAWG games
  are enabled for discovery and import; see Phase 4C.1.
- **Catalog browsing and genre remediation** — Explore's real server-backed
  browse mode (media-type and genre filters, global sorts, bounded pagination,
  and validated shareable URL state) and the canonical book-genre taxonomy are
  deployed and verified. Browse filtering and displayed title genres share the
  same remediated vocabulary.
- **No-environment resilience** — the app builds and renders with no Supabase or
  provider environment variables; curated demo content is clearly labelled as an
  example catalog and never presented as live production activity.

## Phase 4B.2 — Real following feed and honest Home activity (implemented locally)

**Status: implemented locally and verified on seeded local Supabase; NOT yet
applied to hosted Supabase and NOT production-verified.** Migration
`20260815120900_following_feed.sql` (the 29th) has been applied to the local
database only; the hosted rollout is owner-controlled and has not been
performed.

> **Update (2026-09-25):** the statement above is retained as 2026-09-13
> history. A read-only migration-ledger check on 2026-09-25 found the hosted
> database had every migration through `20260815121300` applied, including
> `20260815120900_following_feed.sql` and the likes migrations. The owner treats
> follows, the following feed, likes, and list authorization as
> production-verified, and Phase 4C must preserve them.

What is implemented:

- `public.get_following_feed(...)` — a `SECURITY INVOKER` RPC with a pinned
  empty `search_path`, fully schema-qualified, `EXECUTE` revoked from
  `public`/`anon` and granted to `authenticated`. Viewer identity comes only
  from `auth.uid()`; no caller-supplied viewer id is accepted, and source RLS
  remains an independent boundary. The follows join, self-exclusion,
  linked-review deduplication, total ordering, keyset seek, and page-size clamp
  all happen in SQL, so one bounded page crosses the boundary.
- A server-only read layer (`lib/supabase/feed.ts`, `feed-cursor.ts`,
  `feed-view-model.ts`, `feed-errors.ts`) returning the usual
  `unavailable | signed-out | error | ok` result, with a validated versioned
  cursor and a `limit + 1` end-of-feed probe. Viewer-specific reads use only
  the per-request SSR client — no shared cache.
- A `/feed` route (server-rendered first page plus a "Load more" Server
  Action), a `Feed` primary-nav entry, and a Home `FollowingFeedPreview`
  reading the same reader, with "View all" pointing at `/feed`.
- **Genuine spoiler concealment** — spoiler-marked review text is not rendered
  until the reader activates an accessible `aria-expanded` reveal control.
  Previously `contains_spoilers` was stored but only italicised.
- **Home truthfulness** — "Trending this week", "Popular reviews", and
  "Because you liked …" are gone in configured mode (no trending, likes, or
  recommendation machinery was built to justify them). One honest
  "Explore the catalog" shelf uses the existing real `browseCatalog` reader and
  is omitted entirely when that read is unavailable or fails. A configured read
  failure is reported, never replaced with mock activity. No-environment mode
  keeps clearly labelled example content.

Deliberately not built: an event store, fan-out-on-write, queues, or content
snapshots (see ADR 0005); list activity, favorites, follow announcements,
likes, comments, notifications; inferred "started"/"finished" events; trending
or recommendation algorithms; follow-time cutoffs.

**Local verification actually performed** (2026-09-13): `supabase db reset`,
`supabase test db` (15 files / 443 assertions, including
`following_feed_rpc.test.sql`), regenerated database types with no drift,
lint, typecheck, 1276 unit/component tests, coverage, configured and no-env
production builds, the Storybook build, and all four Playwright suites —
including the new seeded multi-user journey `e2e/feed.spec.ts` (follow →
Home preview → `/feed` → pagination without duplicates → edit → delete →
unfollow → revocation across pages → no leakage when signed out or on another
account).

## Phase 4C.1 — Video-game tracking via RAWG (implemented; partially hosted)

This is an intentional reprioritization: video games and the artwork-led Home
(4C.2) come before the invited beta, and notifications remain the next social
increment afterward. **Video-game tracking** (games as a catalog media type) is
a separate milestone from **entertainment mini-games** (Phase 3 below), which
remain deferred.

Favalog now covers four media types: movies, TV, books, and video games. That
is the current scope, not every possible form of media.

What is implemented:

- `game` is a first-class value of `public.media_kind`, with its own domain
  subtype (`Game` in `lib/types.ts`), game-appropriate statuses, a closed RAWG
  genre vocabulary, and landscape artwork handling. Cross-media UI narrows on
  `kind` rather than duplicating movie/TV/book code.
- A server-only RAWG adapter behind the provider-neutral `lib/catalog/`
  contract: normalization, canonical identity (`rawg` + numeric game id in
  `media_external_ids`), deduplication, external-id validation, disabled
  behavior, error mapping, and refresh. Catalog writes still go only through the
  `service_role` `materialize_media_item(...)` RPC.
- Explore gets a Games filter for search and browse, plus a separate RAWG
  external section. "All media" local results are interleaved across media
  types, with no query-specific logic, so one type can't crowd out the others.
- Title pages show source attribution for every provider, e.g. "Game data from
  RAWG." linking to rawg.io, as RAWG's terms require.
- The operator CLI (`scripts/catalog-import.mjs`) accepts `--provider rawg`.

Status, kept separate:

- **Implemented and unit/pgTAP-tested:** migrations `20260925120000` and
  `20260925120100` are covered by `game_media_and_status.test.sql`. On
  2026-09-25 the last full run on this branch passed 1,397 unit and component
  tests, typecheck, and lint.
- **Hosted:** on 2026-09-25, with explicit owner approval, both games
  migrations were applied to the shared hosted database, and one title (Hades,
  RAWG `274755`) was materialized there through the CLI. `RAWG_ENABLED` and
  `RAWG_API_KEY` are set in the project environment.
- **Preview-verified (2026-09-25):** the Games filter on `/explore` returned
  the materialized game, and `/title/hades` rendered with RAWG attribution.
- **Not production-verified (as of 2026-09-25):** the 4C.1 branch was not yet
  merged or deployed at that time.
- **Update (2026-09-29):** 4C.1 merged to `main` as PR #11. Game discovery is
  covered by the owner's 2026-09-29 production-discovery confirmation. No
  separate games-only production smoke check has been recorded.

### RAWG source permissions

The owner supplied RAWG terms that permit personal use with attribution and
describe limited commercial use. Earlier RAWG pricing text conflicted with
that, and whether RAWG permits caching or embedding its content is still
unresolved. TMDB's staff clarification about cached metadata and embeddings
applies **only to TMDB** and is not permission for RAWG.

Favalog therefore keeps two independent RAWG controls:

- `RAWG_ENABLED` enables discovery and import (currently on).
- `RAWG_EMBEDDING_ENABLED` allows RAWG rows into the embedding pipeline. It is
  **off by default**, and is currently unset.

Even with `RAWG_EMBEDDING_ENABLED` on, the source policy refuses to send RAWG
content to a live embedding provider. Only synthetic (`--fake`) vectors are
allowed, which is how CI tests the pipeline. Until the permission is documented,
games take part in keyword search but not semantic search.

### RAWG semantic search status (2026-09-29)

| Stage               | Status                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| Implemented         | **Yes.** Game documents, backfill, and shared hybrid retrieval are covered by tests.    |
| Permission          | **Unresolved.** `RAWG_EMBEDDING_PERMISSION.status = "unresolved"` (cited record below). |
| Enabled (hosted)    | **No.** `RAWG_EMBEDDING_ENABLED` is unset, and live embedding is refused in code.       |
| Backfilled          | **No.** No live RAWG vectors exist.                                                     |
| Production-verified | **No.**                                                                                 |

The evidence is in `lib/search/embedding-source-policy.ts`
(`RAWG_EMBEDDING_PERMISSION`). It cites `rawg.io/apidocs` and
`rawg.io/tos_api` §6.2 and §4.3(5). The published terms do not mention caching,
derived vectors, or third-party processors, and §6.2 restricts sending RAWG
Content to another server for commercial purposes without written consent. The
owner's authorization is a product decision, and TMDB's clarification covers
TMDB only. Neither one is RAWG permission.

**Outstanding question for RAWG:** may Favalog send RAWG game metadata (title,
year, genres, developers, publishers, platforms, and the RAWG description) to a
third-party embedding API (OpenAI) and store the resulting vectors in Favalog's
own database, used only to rank search results inside Favalog and never
redistributed or exposed?

What is implemented, and how the pieces work together:

- `rowToMediaItem` builds game rows as games. Before this, game rows fell
  through to the book branch. Each document includes platforms, developers, and
  publishers, and never includes lists, reviews, diary entries, or social data.
- Provider-removed rows are never embedded.
- The backfill (`npm run embed:catalog`) adds `--source=<source>` and
  `--max-embed=<n>`, which is resumable: unchanged rows are skipped, so a rerun
  continues from where the last one stopped. A dry run reports the eligible
  count, the rows that would be embedded, and an estimated token count. A live
  dry run also reports the RAWG rows blocked pending permission, with their cost.
  A live `--source=rawg` run exits nonzero and prints the outstanding question.
  The remote-write safeguards are unchanged (`--allow-remote` plus
  `--confirm-project-ref`).
- Retrieval needed no SQL change. `hybrid_search` and `semantic_search` are
  kind-agnostic, so embedded games share the corpus with films and books,
  `p_kind=game` gives games-only results, and cross-media balance already
  includes games.
- Evaluation is fixture-based (Vitest and pgTAP), not measured live relevance.
  It covers exact titles and the ambiguous "odyssey" query, conceptual queries
  across all four kinds, games-only filtering, missing, removed, and ineligible
  (flag-off or live-blocked) embeddings, provider disablement (keyword
  fallback), and partial embedding failures.

**Activation after RAWG answers yes in writing (owner steps):**

1. Add RAWG's written answer to `RAWG_EMBEDDING_PERMISSION.sources` and set
   `status: "documented"` in a reviewed PR.
2. Run a hosted dry run: `RAWG_EMBEDDING_ENABLED=true npm run embed:catalog --
--dry-run --source=rawg --allow-remote --confirm-project-ref=<ref>`. Record
   the eligible count and the token estimate.
3. Set `RAWG_EMBEDDING_ENABLED=true` in the hosted environment.
4. Run the bounded live backfill with the same flags, minus `--dry-run`, plus
   `--max-embed=<n>`. Repeat until nothing is deferred.
5. Run the live search eval (`npm run eval:search`, live mode) and a games-only
   production smoke check, then record the measured results here.

## Phase 4D — Provider discovery and direct saving (increment 1, merged and owner-confirmed)

> **Update (2026-09-29):** merged as PR #13. The owner has confirmed production
> discovery. The status list below is the original pre-merge record.

Home and Explore now surface titles beyond the local catalog. Shelves come
from provider rankings, and the provider is always credited:

- **Films and series (TMDB):** Trending, Popular, Recently released (last 45
  days), Coming soon (films only, next year), and Highest rated (with a
  minimum vote count: 500 for films, 300 for series).
- **Games (RAWG):** Popular, Recently released, Coming soon (confirmed dates
  only), and Highest rated (by Metascore; games without one are left out).
- **Books (Open Library):** Trending this week.

The labels describe what each provider actually ranks by, not an implied
Favalog judgement. Each shelf pages through the provider's own ordering, with
a page cap and a shared-cache freshness window, so provider traffic stays
bounded no matter how many people visit. A provider being down or disabled
hides only its shelves.

A signed-in user can save a discovered title straight into one of their lists
in one step. The server materializes the title through the existing RPC and
then adds it to the list. Signed-out viewers are sent to sign in, and
incomplete profiles to onboarding, each with a safe return path. Titles already
in Favalog link directly to their `/title/[slug]` page.

Status:

- **Implemented and unit-tested** on `v0/phase-4d-discovery-saving`: 19
  discovery-layer tests and 13 save-action tests. Typecheck and lint are clean.
- **Server-render checked:** Home returns the film, series, game, and book
  shelves, and `/explore?type=game&sort=upcoming` returns RAWG cards with
  pagination, both via the dev server. Interactive browser verification (the
  save flow and paging clicks) is still pending, because the sandbox browser
  timed out on navigation.
- **Not hosted or production-verified.** This increment needs no migrations.

## Phase 4D — Discovery completion (increment 2, merged and owner-confirmed)

> **Update (2026-09-29):** merged as PR #14, with the follow-up "Create new
> list" for every user merged as PR #15. The owner has confirmed production
> discovery, artwork improvements, social interactions, and creating a list
> while saving. The status list below is the original pre-merge record.

This increment makes provider discovery the main way to browse Favalog:

- **Artwork completeness.** A single classifier (`lib/media/artwork.ts`)
  decides whether a title has real provider artwork. Posters and backdrops
  that fail to load fall back to a designed placeholder instead of a broken
  image. Demo seed rows (`source = 'favalog'`) never appear on promotional
  surfaces.
- **Discovery-led Home.** An artwork-led hero is chosen from provider
  discovery. Date-based "New releases" and "Coming soon" shelves come next,
  and local shelves are demoted below them and show only titles with
  artwork.
- **Explore overview.** With no query, the All view shows a balanced overview
  of every media type, and each category leads with its discovery shelves.
- **Saving intent.** Signing in from a Save control returns the viewer to the
  same page with that card's picker reopened. A viewer with no lists can
  create their first list inside the save dialog.
- **Related titles.** Title pages show titles linked by an explicit provider
  relationship: the TMDB collection, the RAWG developer, or the Open Library
  author. Headings state the relationship. The feature follows the discovery
  cache, flag, and failure rules, and the section hides whenever the provider
  is unavailable.

Status:

- **Implemented and unit-tested** on `v0/phase-4d-2-discovery-complete`. The
  full suite passes (1,473 tests), and typecheck, lint, and formatting are
  clean.
- **Server-render checked** via the dev server: the Home hero and shelves,
  plus the related groups for Avengers: Endgame (collection), Hades
  (developer), and Dune (author).
- **Browser verification pending.** The sandbox has no browser runtime, so
  the interactive save-intent return and inline list creation still need a
  preview check.
- **Not hosted or production-verified.** No migrations are required.

## Remaining gaps

- Community reviews still render from the `@/lib/data` mock layer rather than
  real Supabase reads. Home's activity is now real (Phase 4B.2), but there is
  no community-review system behind it.
- Live RAWG embedding is blocked on documented permission (see above). Games
  take part in keyword search only.
- The scheduled `catalog-refresh` workflow exists on `main`, but no manual or
  scheduled run has been recorded, and the state of `CATALOG_REFRESH_ENABLED`
  is unverified.
- The `@fixtures`, `social`, and `likes` Playwright suites run locally but not
  in CI.
- Possible duplicate RAWG candidates (the same game appearing as more than one
  provider result) are tracked as a separate data-quality issue. Canonical
  records are never merged, and user data is never deleted, on title
  similarity alone.
- Comments, blocking, private accounts, and follower directories remain
  deferred.
- Growth and monetization have not started. Portfolio packaging begins in
  Phase 4E (below).

## Phase 4E — Production quality and portfolio readiness (in progress)

The earlier two-PR plan has been delivered across the baseline/evidence and
quality-fix PRs through #20. It is retained in Git history, not described as
future work here. Closeout PR #21 restores discovery-first Explore, corrects
artwork-backed screenshot/quality readiness, retains first-failure traces,
adds retry-free first-list repetitions, and completes per-invocation CI gates.

MVP 1 is **not accepted yet**. Latest main CI counts/artifacts, the hosted
migration and deployed SHA are verified. Authenticated production/saved-record
smoke, screen-reader announcements, actual zoom, contrast/manual axe review,
safe partial-failure rehearsal and protected refresh/schedule-state acceptance
remain open, with no reviewed release waiver. See the
[release checklist](mvp1-release-checklist.md). The existing
[invited-beta script](beta/invited-beta-checklist.md) stays a future owner-led
activity, not evidence of completed user research. No performance improvement
is claimed without comparable measurements.

Out of scope: notifications, billing, mini-games, new providers, and
personalized recommendations.

## Agreed phase sequence

1. **Product Reality and Discovery UX (delivered)** — real server-backed catalog
   browsing, sorting, filtering, pagination, theming, and truthful documentation.
2. **Social Graph and Network Loops** — follows, follower-aware visibility,
   likes, notifications, and the social feedback loops around the personal
   record.
   - **Phase 4C (reprioritized, before the invited beta):** 4C.1 video-game
     tracking via RAWG and 4C.2 artwork-led Home. Notifications follow as the
     next social increment.
3. **Entertainment mini-games** — lightweight entertainment-knowledge games
   layered on the catalog. This is distinct from video-game tracking (4C.1).
4. **Personalized AI Discovery** — personalized, taste-aware recommendations
   built on the existing retrieval foundation.
5. **Catalog and AI Operations** — scaling ingestion, embedding operations,
   observability, and provider expansion (including the TMDB compliance gate).
6. **Growth and Monetization** — acquisition, retention, and sustainable revenue.
7. **Portfolio Packaging** — case studies, writeups, and presentation of the
   work.

### Outcomes per phase

| Phase                             | Product                                                                     | Technical                                                                                                            | Career                                                                          | Branding                                                    |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Product Reality & Discovery UX | A visitor can genuinely browse and theme the real catalog, not just a demo. | A server-only browse DAL with stable ordering, bounded pagination, validated URL state, and a no-flash theme system. | Demonstrates production data plumbing, accessibility, and honest documentation. | A polished, editorial, light/dark-ready first impression.   |
| 2. Social Graph & Network Loops   | People connect around their records and get feedback.                       | Real follows/likes/notifications with RLS and safe fan-out.                                                          | Shows social-system and authorization design.                                   | Positions Favalog as a social platform, not a solo tracker. |
| 3. Entertainment mini-games       | A fun, sticky reason to return.                                             | Deterministic, catalog-backed game logic with fair scoring.                                                          | Demonstrates playful product thinking on real data.                             | Distinctive, memorable brand moments.                       |
| 4. Personalized AI Discovery      | Recommendations that feel personally tuned.                                 | Taste modeling on top of the existing embedding/retrieval seam.                                                      | Shows applied ML/retrieval judgment with guardrails.                            | "Discovery that gets you" as a brand promise.               |
| 5. Catalog & AI Operations        | A larger, fresher, more trustworthy catalog.                                | Robust ingestion/embedding ops, observability, provider governance.                                                  | Demonstrates operational maturity and compliance discipline.                    | Trust through accuracy and attribution.                     |
| 6. Growth & Monetization          | A sustainable, growing product.                                             | Acquisition, retention, and billing infrastructure done safely.                                                      | Shows business and growth literacy.                                             | A credible, fundable brand story.                           |
| 7. Portfolio Packaging            | A clearly communicated body of work.                                        | Reproducible writeups and demos.                                                                                     | A strong, honest portfolio artifact.                                            | Consistent, professional external presentation.             |

## Historical non-goals for Phase 1 — Product Reality

The original Phase 1 scope deliberately excluded:

- Migrating Home, community reviews, follows, likes, notifications, games, or
  recommendations off mock data.
- Games, generative AI (LLM-written text/chat/agents), billing/monetization,
  background queues, Kubernetes, or new catalog providers.
- Enabling TMDB or adding TMDB titles to the OpenAI embedding corpus.
- Any hosted mutation, Vercel variable change, deployment, or production
  re-embedding.
- Drag-and-drop / arbitrary reordering or curator notes.

The follow lifecycle and follower-only list visibility are no longer non-goals:
they were delivered and production-verified in Phase 4B.1. The separate Phase
4B.2 feed and Home-activity work is implemented locally (see above) and awaits
the owner-controlled hosted rollout.

## Explicitly deferred work

The following remain deferred and are not implied by the Phase 4B.1 delivery or
the locally implemented Phase 4B.2 feed:

- Live scheduled catalog refresh remains owner-controlled and unverified:
  observed schedules skipped, and activation-variable access returned 403.
  Intentional release deferral is not yet owner-confirmed; automatic freshness
  may be unavailable. Protected dry-run rehearsal and schedule-state confirmation
  remain acceptance gates, not passed checks (see the release checklist).
- Live RAWG embedding, until permission is documented.
- Notifications, email, and push.
- Moderation.
- Entertainment mini-games, which are separate from video-game tracking.
- News aggregation, billing, achievements, and console sync.
- Personalized discovery and recommendation algorithms.

## Success measures

Measured honestly, without inventing traffic or business metrics:

- A production-configured visitor can open `/explore` with no query, encounter
  provider discovery first, and browse the clearly identified real Supabase
  catalog below it; no demonstration catalog is exposed as live content.
- Browse filters, sorts, and pagination operate globally and restore correctly
  from a shared URL.
- Search queries retain the evaluated hybrid-relevance behavior (offline eval
  thresholds continue to pass).
- Read failures never present mock data as production data.
- Light, dark, and system themes work without hydration flash and preserve the
  Favalog brand.
- Documentation keeps the historical 29-title observation dated 2026-09-01;
  it does not restate it as a current production count.
- The relevant validation matrix (format, lint, typecheck, unit/coverage, both
  build modes, Storybook, relevant Playwright, and — when schema/types change —
  Supabase reset + pgTAP + type-drift) passes.
