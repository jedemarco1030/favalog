# Favalog product roadmap

> Living document. Last reconciled: 2026-09-13, against the verified production
> state below. Update this file whenever a phase ships, a capability becomes
> production-verified, or the agreed sequence changes. When a statement is only
> true at a point in time, keep it and date it rather than deleting the history.

## Product vision

Favalog is a social entertainment platform for tracking, rating, reviewing,
organizing, and discovering movies, television, and books. Over time a person's
Favalog becomes a living record of the entertainment and interests they love.
Movies, TV, and books are media types inside shared experiences — a single
cross-media diary, list, review, favorite, and discovery surface — **not**
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
  materialization. Open Library is enabled and production-verified; TMDB is
  gated off.
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

## Remaining gaps

- Community reviews still render from the `@/lib/data` mock layer rather than
  real Supabase reads. Home's activity is now real (Phase 4B.2), but there is
  no community-review system behind it.
- Phase 4B.2 is local-only: migration `20260815120900` has not been applied to
  hosted Supabase, so the following feed is not yet available in production.
- Comments, blocking, private accounts, and follower directories remain
  deferred.
- Growth, monetization, and portfolio-packaging work has not started.

## Agreed phase sequence

1. **Product Reality and Discovery UX (delivered)** — real server-backed catalog
   browsing, sorting, filtering, pagination, theming, and truthful documentation.
2. **Social Graph and Network Loops** — follows, follower-aware visibility,
   likes, notifications, and the social feedback loops around the personal
   record.
3. **Games** — lightweight entertainment-knowledge games layered on the catalog.
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
| 3. Games                          | A fun, sticky reason to return.                                             | Deterministic, catalog-backed game logic with fair scoring.                                                          | Demonstrates playful product thinking on real data.                             | Distinctive, memorable brand moments.                       |
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

- TMDB activation and the owner-controlled refresh implementation for cached
  metadata and embeddings; `TMDB_ENABLED` remains **false**.
- Notifications.
- Moderation.
- Games.
- Personalized discovery and recommendation algorithms.

## Success measures

Measured honestly, without inventing traffic or business metrics:

- A production-configured visitor can open `/explore` with no query and browse
  only real Supabase catalog titles.
- Browse filters, sorts, and pagination operate globally and restore correctly
  from a shared URL.
- Search queries retain the evaluated hybrid-relevance behavior (offline eval
  thresholds continue to pass).
- Read failures never present mock data as production data.
- Light, dark, and system themes work without hydration flash and preserve the
  Favalog brand.
- Documentation accurately describes the verified 29-title production state.
- The relevant validation matrix (format, lint, typecheck, unit/coverage, both
  build modes, Storybook, relevant Playwright, and — when schema/types change —
  Supabase reset + pgTAP + type-drift) passes.
