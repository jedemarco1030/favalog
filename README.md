# Favalog

Favalog is a social entertainment platform for tracking, rating, reviewing,
organizing, and discovering **movies, TV series, books, and video games** in one
cross-media record. Discovery is led by external providers. The canonical
catalog stores only the titles people actually engage with.

> Status is reconciled as of **2026-09-29** against `main`. Each capability
> below is labelled by its evidence: implemented in code, CI-verified,
> owner-confirmed in production, or unverified/deferred. The authoritative
> per-capability table is the "Status reconciliation" section of
> [`docs/product-roadmap.md`](docs/product-roadmap.md). The earlier, longer
> README is preserved verbatim at
> [`docs/history/readme-through-phase-4d.md`](docs/history/readme-through-phase-4d.md).

## Live demo and screenshots

- **Live deployment:** <https://favalog.vercel.app>
- **Screenshots:** not yet committed. The v0 sandbox cannot run a browser, so
  screenshots will be captured from CI Playwright runs or real sessions,
  never mock-ups.
- **Engineering case study:** [`docs/case-study.md`](docs/case-study.md).

## What Favalog does

| Media type | Discovery and metadata source | Canonical identity    | Semantic search             |
| ---------- | ----------------------------- | --------------------- | --------------------------- |
| Movies     | TMDB                          | `tmdb` + `movie:<id>` | Yes (owner-permitted)       |
| TV series  | TMDB                          | `tmdb` + `tv:<id>`    | Yes (owner-permitted)       |
| Books      | Open Library                  | Open Library Work id  | Yes                         |
| Games      | RAWG                          | `rawg` + numeric id   | **No**: keyword search only |

The **RAWG limitation**: game discovery, import, and keyword search work, and
title pages credit RAWG. Live semantic embedding of RAWG content is blocked in
code (`RAWG_LIVE_EMBEDDING_PERMISSION_DOCUMENTED = false`) and by the
`RAWG_EMBEDDING_ENABLED` flag until RAWG's permission is documented.

### Current user journeys

All of these are implemented and owner-confirmed in production:

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
| `social`, `likes` journeys                    | `npm run test:e2e:social` / `:likes` | **Not yet**: run locally                          |

Tests never mutate hosted production. The `@fixtures` suite refuses to start
when `SUPABASE_URL` points at a hosted project. Laboratory measurements are
documented in [`docs/quality/baseline.md`](docs/quality/baseline.md). They are
not real-user metrics, and a passing automated accessibility scan does not
establish accessibility compliance.

Development happens in a browser-only environment (v0 on a sandbox VM without
a browser runtime). Browser evidence therefore comes from GitHub Actions, and a
successful compile is never treated as verification. The project is built with
AI assistance: the owner sets requirements and reviews, merges, and confirms
production behavior.

## Known limitations

- RAWG content is not semantically searchable (see above).
- Community reviews on some surfaces still come from the labelled mock layer.
- `catalog-refresh.yml` is on `main`, but no run has been recorded, and
  whether it is enabled on the hosting side is unverified.
- The `social` and `likes` Playwright suites are not yet in CI.
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
