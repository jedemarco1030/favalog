# Favalog

Favalog is a social entertainment platform for tracking, rating, reviewing,
organizing, and discovering **movies, TV series, books, and video games** in one
cross-media record. Discovery is led by external providers. The canonical
catalog stores only the titles people actually engage with.

> Status is reconciled as of **2026-09-30** against post-merge `main` at
> `1c076a3` (merged PR #21) and [PR #22](https://github.com/jedemarco1030/favalog/pull/22)
> application source `76bb608`. Likes and following feed now execute and pass on
> the follow-up CI attempt; complete final-branch and post-merge CI remain release
> gates. **MVP 1 acceptance is still pending**; see the
> [release checklist](docs/mvp1-release-checklist.md). Each capability
> below is labelled by its evidence: implemented in code, CI-verified,
> owner-confirmed in production, or unverified/deferred. The authoritative
> per-capability table is the "Status reconciliation" section of
> [`docs/product-roadmap.md`](docs/product-roadmap.md). The earlier, longer
> README is preserved verbatim at
> [`docs/history/readme-through-phase-4d.md`](docs/history/readme-through-phase-4d.md).

## Live demo and screenshots

- **Live deployment:** <https://favalog.vercel.app>
- **Screenshots:** fresh read-only production Home captures on **2026-09-30**,
  with decoded genuine RAWG artwork, at 1280×900 and 390×844. They show the
  deployed baseline, not this unapplied follow-up or release acceptance.
  Offline fixture captures are separate test evidence, never authentic covers.
- **Genuine provider preview captures:** final application-source desktop/mobile
  Home, Explore, search and title images are retained in the
  [quality evidence index](docs/quality/baseline.md#follow-up-source-evidence-2026-09-30).
  The hosted retrieval migration is not yet applied; authenticated Save evidence
  comes separately from isolated CI fixtures.
- **Engineering case study:** [`docs/case-study.md`](docs/case-study.md).

![Production Home with genuine RAWG artwork, captured read-only](docs/screenshots/home-desktop-production.png)

[Production mobile Home](docs/screenshots/home-mobile-production.png).
Both screenshots show the actual application, never mock-ups.

## What Favalog does

| Media type | Discovery and metadata source | Canonical identity    | Semantic search             |
| ---------- | ----------------------------- | --------------------- | --------------------------- |
| Movies     | TMDB                          | `tmdb` + `movie:<id>` | Yes (owner-permitted)       |
| TV series  | TMDB                          | `tmdb` + `tv:<id>`    | Yes (owner-permitted)       |
| Books      | Open Library                  | Open Library Work id  | Yes                         |
| Games      | RAWG                          | `rawg` + numeric id   | **No**: keyword search only |

The **RAWG limitation**: game discovery, import, and keyword search work, and
title pages credit RAWG. Game semantic search is implemented and covered by
fixture tests, but it is not enabled: live embedding of RAWG content is refused
in code (`RAWG_EMBEDDING_PERMISSION.status = "unresolved"`) and gated by the
`RAWG_EMBEDDING_ENABLED` flag until RAWG's permission is documented. See the
roadmap's "RAWG semantic search status" for the outstanding question and the
activation steps.

### Current user journeys

These journeys are implemented and owner-confirmed in the production baseline
through 2026-09-29. Closeout presentation/reliability changes require fresh
release acceptance; fixture CI is not production confirmation:

1. **Discover without searching.** Home and the empty-query Explore view show
   provider-ranked shelves (Trending, New releases, Coming soon, Highest
   rated) with an artwork-led hero. A failing provider hides only its own
   shelves.
2. **Search.** Explore runs hybrid search (Postgres full-text plus pgvector,
   fused with Reciprocal-Rank Fusion) over the local catalog, alongside
   federated provider results.
3. **Save a discovered title.** Save materializes the title idempotently and
   adds it to a list. Signed-out viewers sign in and return to the same card
   with its picker open.
4. **Create a list while saving.** "+ Create new list" is available whether
   the user has no lists or several. If the list is created but the save
   fails, retry re-runs only the save, so it never creates a duplicate list.
5. **Related titles.** Title pages show titles linked by an explicit provider
   relationship: the TMDB collection, the RAWG developer, or the Open Library
   author.
6. **The personal record.** Diary entries with optional reviews, lists with
   public, followers-only, or private visibility, favorites, and profiles.
7. **Social.** Follows, follower-only lists enforced by Row Level Security, a
   following feed, and likes on reviews and lists.

## Architecture

- **Next.js 16 App Router** (React 19.2): Server Components by default,
  Server Actions for mutations, and `proxy.ts` for session refresh only.
- **Supabase**: Postgres with Row Level Security on every user table, SSR
  cookie auth (`@supabase/ssr`), `SECURITY INVOKER` RPCs scoped to
  `auth.uid()`, and forward-only migrations with generated types
  (`lib/database.types.ts`).
- **Catalog platform** (`lib/catalog/`): provider-neutral adapters for TMDB,
  Open Library, and RAWG. Catalog writes go only through the `service_role`
  `materialize_media_item(...)` RPC. Canonical aliases live in
  `media_external_ids`.
- **Discovery** (`lib/discovery/`): server-side provider reads with a shared
  cache freshness window, page caps, and per-provider flags. Failures stay
  isolated per shelf.
- **Search**: hybrid retrieval with exact-title protection, a semantic
  relevance cutoff, and provider-eligibility gates. It degrades to
  keyword-only search when embeddings are unavailable.

Further reading: [`docs/backend-architecture.md`](docs/backend-architecture.md),
[ADRs](docs/adr/),
[`docs/ai-discovery-system-card.md`](docs/ai-discovery-system-card.md), and
[`docs/tmdb-activation-rollout.md`](docs/tmdb-activation-rollout.md).

## Development setup

```bash
npm ci
npm run supabase:start          # local Supabase stack (Docker)
npm run supabase:reset          # apply migrations and seed
npm run dev
```

The app builds and renders with **no** environment variables. Without Supabase
it runs in no-env mode, and curated demo content is labelled as an example
catalog. To enable providers, set the server-only flags `EXTERNAL_CATALOG_ENABLED`,
`TMDB_ENABLED` with `TMDB_API_READ_TOKEN`, `OPEN_LIBRARY_ENABLED`, and
`RAWG_ENABLED` with `RAWG_API_KEY`. Code defaults are described in
[`docs/backend-architecture.md`](docs/backend-architecture.md#environment-variables).
Defaults are not deployment state.

Operator scripts: `npm run catalog` (import), `npm run refresh:catalog`,
`npm run embed:catalog`, and `npm run eval:search`.

## Verification approach

| Check                                         | Command                              | Runs in CI                                        |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| Format, lint, typecheck                       | `npm run validate`                   | Yes                                               |
| Unit and component tests (Vitest, coverage)   | `npm run test:coverage`              | Yes                                               |
| Schema and RLS tests (pgTAP)                  | `npm run db:test`                    | Yes (local Supabase)                              |
| Generated types drift                         | `npm run supabase:types`             | Yes                                               |
| Playwright `default` and `no-env`             | `npm run test:e2e:no-env`            | Yes                                               |
| Seeded Explore journeys                       | `npm run test:e2e:configured`        | Yes (local Supabase)                              |
| Quality baseline (performance and a11y lab)   | runs inside the `default` project    | Yes; evidence in the `playwright-report` artifact |
| `@fixtures` (offline provider fixture server) | `npm run test:e2e:fixtures`          | Yes (local Supabase)                              |
| `social`, `likes` journeys                    | `npm run test:e2e:social` / `:likes` | Yes (separate local Supabase jobs)                |

Tests never mutate hosted production. The `@fixtures` suite refuses to start
when `SUPABASE_URL` points at a hosted project. Laboratory measurements are
documented in [`docs/quality/baseline.md`](docs/quality/baseline.md). They are
not real-user metrics, and a passing automated accessibility scan does not
establish accessibility compliance.

Development happens in v0. Read-only preview checks can use its remote browser;
Docker-backed fixture verification and portfolio capture run in GitHub Actions.
A successful compile is never treated as verification. The project is built with
AI assistance: the owner sets requirements and reviews, merges, and confirms
production behavior.

## Known limitations

- The demonstration-separation follow-up requires owner application of
  `20260930180000_separate_demonstration_catalog.sql` before deployment acceptance.
  Saved IDs/routes/references are preserved; ordinary discovery excludes only
  the known demonstration identities, not every internal catalog title.
- The synthetic golden dataset is now local-fixture-only. Live semantic-quality
  evaluation is explicitly deferred until genuine-provider judgments are reviewed;
  the evaluator refuses paid calls against that fixture dataset.
- Inspected post-merge CI `36749917450` passed 20 retry-free first-list journeys
  and 34 fixtures, but failed likes startup on port 54324 before tests executed.
  Its results do not verify this follow-up or authorize an invited beta.

- RAWG content is not semantically searchable (see above).
- Community reviews on some surfaces still come from the labelled mock layer.
- Catalog-refresh scheduling exists, but the five latest observed scheduled
  runs skipped the refresh job (latest: `36702695138`, inspected 2026-09-30). This is not evidence
  of processing. Activation is a **GitHub Actions** variable, not a Vercel
  environment variable; owner operational acceptance is still required.
- MVP 1 is **not yet accepted**. See the
  [release checklist](docs/mvp1-release-checklist.md) for outstanding evidence
  and owner screen-reader/operational checks.
- Possible duplicate RAWG candidates are tracked as a data-quality issue.
  Records are never merged on title similarity alone.
- There are no notifications, comments, blocking, or private accounts yet.

## Next priorities

Phase 4E: production quality and portfolio readiness. Measured
performance and accessibility fixes, regression coverage for the critical
journeys, redacted operational events, an engineering case study, and a small
invited-beta session ([`docs/beta/invited-beta-checklist.md`](docs/beta/invited-beta-checklist.md)).
Notifications, billing, mini-games, new providers, and personalized
recommendations are outside this phase.
