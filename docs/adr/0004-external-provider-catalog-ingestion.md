# 0004 — Catalog Platform v1A: external-provider catalog ingestion foundation

- **Status:** Accepted
- **Date:** 2026-08-30
- **Phase:** 4 (Catalog Platform — ingestion foundation)
- **Builds on:** [0001 — Supabase/PostgreSQL as the Favalog backend](0001-supabase-backend.md), [0003 — AI Discovery v1: hybrid catalog retrieval](0003-ai-discovery-hybrid-catalog-retrieval.md)

## Context

Favalog's catalog has to date been a curated, static set of 28 movies, TV shows, and books. While this was ideal for building the backend foundation and evaluating AI Discovery, the platform needs a way to grow its catalog from trusted external sources without compromising the integrity, security, or performance of the existing social features.

The requirements shaping this foundation phase:

- **Provider-neutral ingestion.** The platform must support multiple media types (movies, TV, books) and providers (TMDB, Open Library) without leaking provider-specific shapes into the core application.
- **Trusted materialization.** The platform must never trust caller-supplied metadata. Ingestion must be identity-only, where the server re-fetches and normalizes data from the source.
- **Stable identity and deduplication.** We must reuse the existing `media_items (source, external_id)` unique identity to prevent duplicates and ensure stable relationships (logs, lists, favorites).
- **Keyword-immediate, embedding-eventual.** Newly ingested items must be searchable by keyword immediately (via `search_tsv`), while their semantic embedding is handled asynchronously by the existing guarded CLI.
- **Reliability and attribution.** External calls must be bounded, retried safely, and cached. We must honor provider attribution requirements (TMDB notice/logo) and identification rules (Open Library User-Agent).
- **Security by default.** Write operations to the catalog remain server-only and privileged. The database RPC for materialization must be restricted to the `service_role`.
- **Operator-first tooling.** Growth is driven by an operator CLI with the same remote-write protections as the embedding pipeline; no automated or user-facing ingestion is introduced yet.

## Decision

Ship **Catalog Platform v1A** as a server-only foundation for trusted external-provider ingestion:

1.  **A provider-neutral catalog contract** in `lib/catalog/`. This internal API defines pure normalized types (`ExternalProvider`, `ExternalRef`, `NormalizedMediaItem` union, `ProviderPage`) and interfaces (`CatalogProvider`, `CatalogMaterializer`). The rest of the app depends only on these normalized shapes.
2.  **TMDB Adapter (Movies & TV).** A server-only adapter using bearer auth (`TMDB_API_READ_TOKEN`). It searches movies and TV (excluding people/adult results) in `en-US`, fetching trusted detail before normalization. It maps titles, synopses, release years, genres, credits (directors/cast/creators), and image paths resolved against the approved TMDB host.
3.  **Open Library Adapter (Books).** A server-only adapter using the `Work` ID as the canonical identity. It identifies itself via a `User-Agent` containing `OPEN_LIBRARY_CONTACT_EMAIL` and is designed for low-volume discovery with caching. It maps titles, authors, first publication years, genres (from subjects), and covers.
4.  **Identity & Materialization Boundary.**
    - **Identity:** Reuses `media_items (source, external_id)`. TMDB uses kind-qualified IDs (e.g., `movie:123`, `tv:123`) to prevent kind collisions; Open Library uses the stable Work ID.
    - **Materialization:** A server-only process that takes only `{ provider, kind, external_id }`, re-fetches trusted upstream detail, normalizes it, and writes via the `public.materialize_media_item(...)` RPC.
    - **Slugs:** Slugs are generated server-side using the existing collision-safe suffixing; re-importing an item never changes its slug.
5.  **SQL Foundation (Migration 24).** Adds `content_hash`, `normalization_version`, and `synced_at` columns to `public.media_items` for provenance and staleness tracking. The `materialize_media_item` RPC is `SECURITY INVOKER` with a pinned `search_path=''`, schema-qualified, and restricted to `service_role` EXECUTE (revoked from `public`, `anon`, and `authenticated`).
6.  **Reliability & Caching.**
    - **Timeouts:** Bounded 5000ms per request.
    - **Retries:** Max 3 attempts total for transient failures (429, 5xx, timeout) with exponential backoff + jitter; `Retry-After` is honored (capped at 10s).
    - _Caching:_* Framework-level `next.revalidate` caching: 1 hour for search results, 24 hours for media details.
    - **Operational Logs:** Redaction-safe structured logs (`event: "catalog_provider"`) carrying only metadata (provider, operation, outcome, latency bucket, retry count) — never query text or raw payloads.
7.  **Search & Embedding Lifecycle.** Materialized items are keyword-searchable immediately because `search_tsv` is a generated column. The embedding pipeline (`npm run embed:catalog`) auto-detects these rows as missing/stale and embeds them asynchronously. No synchronous OpenAI calls are made during ingestion.
8.  **Operator CLI (`npm run catalog`).** A fail-closed CLI (`scripts/catalog-import.mjs`) for `search`, `inspect`, and `import`. It enforces the repo's remote-target safety pattern: writing to a remote Supabase requires **both** `--allow-remote` and `--confirm-project-ref=<ref>`.

### Why TMDB and Open Library

TMDB provides a high-quality, free-tier-friendly API for movies and TV with a stable identity system. Open Library provides a mission-aligned, open-data foundation for books with a canonical Work-based identity that fits Favalog's "one place for everything" model.

### Why Trusted Materialization

Directly importing client-supplied data leads to catalog corruption, XSS, and broken relationships. By requiring the server to re-fetch and normalize data from the source, we ensure that every catalog item meets Favalog's quality and schema requirements, and that identity remains authoritative.

### Why a kind-qualified TMDB ID

TMDB uses separate numeric ID spaces for movies and TV shows, which can collide (e.g., Movie 123 and TV Show 123 are different entities). By storing `external_id` as `movie:123` or `tv:123`, we ensure a unique primary key in the `media_items` table.

### Why an immutable slug

Media slugs are the canonical URL for a title. Allowing them to change on re-import would break user bookmarks, shared links, and history. The server-generated slug is generated once at first import and remains stable.

### Why synchronous OpenAI is avoided

Embedding a catalog item involves a network call to OpenAI and a vector write. Making this synchronous during ingestion would increase latency and introduce a failure point that isn't strictly necessary for the item to be "available" (keyword-searchable). Eventual semantic compatibility is a safer, more performant default.

### Why user-facing external search is deferred

Adding millions of external results to `/explore` requires careful UX work (distinguishing "in-catalog" vs "external") and potentially different ranking logic. This phase focuses on the **foundation** for growing the real catalog; surfacing external results is a separate product slice.

## Consequences

- **Attribution Obligations.** The platform MUST show the TMDB attribution notice and logo before any user-facing TMDB results are enabled in a future phase.
- **Env Var Requirements.** `TMDB_API_READ_TOKEN` and `OPEN_LIBRARY_CONTACT_EMAIL` are now required for live provider requests.
- **Catalog Growth.** The catalog can now grow beyond the initial 28 titles through operator-driven imports.
- **Provenance Tracking.** We can now detect when a stored item was last synced and whether our normalization logic has changed since then.
- **RPC Restriction.** Browser-based roles can never trigger materialization; it is strictly a server/operator capability.

## Amendment — Catalog Platform v1B: canonical identity & federated Explore (2026-08-30)

v1A keyed catalog identity solely on `public.media_items (source, external_id)`. That is insufficient once external results are exposed to users, because a curated `source='favalog'` row can represent the **same real-world work** as a provider result (the curated _Dune: Part Two_ is TMDB movie `693134`). Materializing the provider result under a new `(source, external_id)` would create a **second** row, splitting diary entries, reviews, lists, and favorites across two ids. This amendment records the forward-only design that solves canonical identity **before** any user-controlled import is exposed.

### Decisions

1. **Canonical alias table (Migration 25 — `20260815120600_media_external_ids.sql`).** A forward-only `public.media_external_ids` table links a canonical `media_items` row to one or more provider identities. Constraints: `unique (provider, kind, external_id)` (a provider identity resolves to at most one canonical row — the resolution authority) and `unique (media_id, provider, kind)` (a canonical row carries at most one identity per provider+kind, so a second/different id surfaces as a conflict and is rejected rather than silently attached). `FK … ON DELETE CASCADE` guarantees no orphan links. RLS is enabled with a public-read policy (identity only), and browser roles get `SELECT` only; writes are `service_role`-only.

2. **Canonical-resolving RPC — `public.materialize_external_media(...)`.** Same security model as `materialize_media_item` (`SECURITY INVOKER`, pinned `search_path=''`, fully schema-qualified, `service_role`-only EXECUTE, identity-only return). It resolves a provider identity **in a fixed order** before writing:
   1. **Existing exact provider link** (`media_external_ids`) → reuse (`resolution: existing`).
   2. **Existing provider row** (`media_items.source/external_id`) → backfill the alias + reuse (`existing`).
   3. **Conservative deterministic candidate** → attach to an existing title (`linked`): **exactly one** `media_items` row whose **normalized title + kind + release/publication year** match. Normalization is lowercase + non-alphanumerics collapsed to single spaces — **exact-normalized equality, never fuzzy or semantic similarity.**
   4. **No match** → create a new canonical row with a collision-safe immutable slug (`created`).
      It is atomic, idempotent, and concurrency-safe (a transaction-scoped advisory lock on the provider identity; unique constraints remain the ultimate authority).

3. **Fail safe on ambiguity.** More than one deterministic candidate, or a candidate already carrying a different identity for the same provider+kind, raises `P0003` and attaches nothing — Favalog never mis-attaches a provider identity to the wrong title.

4. **Preservation & provider-metadata policy.** When an existing (especially curated) title is matched, its media id, immutable slug, title, year, genres, and **community `average_rating` are preserved**; only genuinely empty provider-controlled presentation fields (subtitle/synopsis/poster/backdrop) are filled, and provenance (`content_hash`/`normalization_version`/`synced_at`) is recorded. User-generated data is never overwritten.

5. **No backfilled fictional mappings.** The 28 curated titles are mostly fictional works; only _Dune: Part Two_ is a real work. No provider links are seeded in the migration — the deterministic resolver links _Dune: Part Two_ on first import, which is proven by pgTAP (`supabase/tests/database/media_external_ids.test.sql`): importing TMDB `movie:693134` links to the existing row and creates **no** second _Dune: Part Two_.

6. **Shared write path + CLI.** The pure materializer (`lib/catalog/materialize.ts`) now targets `materialize_external_media` by default and surfaces the `linked | existing | created` outcome; the legacy `materialize_media_item` remains selectable. Both the server wiring and the operator CLI (`npm run catalog import`) therefore get canonical de-duplication automatically, and the CLI reports the resolution outcome.

7. **Opt-in federation flags.** A server-only `EXTERNAL_CATALOG_ENABLED` gate (`lib/catalog/feature-flag.ts`, with `isExternalCatalogEnabled`, `availableExternalProviders`, and `shouldOfferExternalCatalog`) defaults **off**; external discovery runs only when the global flag is truthy, the relevant per-provider flag (`TMDB_ENABLED`, `OPEN_LIBRARY_ENABLED`) is truthy, **and** the relevant provider is configured. When unset/disabled or unconfigured, `/explore` keeps its existing local hybrid search unchanged, with no external calls and no build/import-time crash.

8. **Federated Explore (now wired).** `/explore` (`app/explore/page.tsx`) still runs local hybrid search first, then — **only** for a committed non-empty query, **only** when `EXTERNAL_CATALOG_ENABLED` is on, the provider's own flag is on, **and** a provider is configured — streams two independent Suspense sections, "More movies & TV" (TMDB) and "More books" (Open Library) (`components/media/external-results-section.tsx`). Providers are called **server-side only**, never from the browser and never for an empty query / the editorial view. **External rankings are not blended into the local RRF**; they are clearly separate, attributed sections. One provider failing never hides the local results or the other provider. Each external candidate is resolved against canonical identity (`lib/supabase/external-resolution.ts`, exact provider-link / provider-row only): already-existing titles link straight to `/title/[slug]` and are never offered for import, and duplicates already shown locally are dropped.

9. **On-demand materialization flow.** The Server Action `materializeExternalTitleAction` (`app/explore/actions.ts`) with the pure form contract `app/explore/materialize-form.ts` accepts from the client **only** provider, media kind, external id, and a safe `returnTo` — **never** title/slug/year/artwork/synopsis/rating/credits/authors. It re-checks the feature flag, independently re-authenticates via the auth DAL, requires a complete onboarded profile, validates/allow-lists the identity (`validateMaterializeInput`), requires the service-role admin client, and calls the trusted canonically-resolving server materializer (`lib/catalog/server-materializer.ts` → `materialize_external_media`). It handles the `linked | existing | created` outcome, revalidates `/explore` and `/title/[slug]`, then performs an authoritative server redirect to `/title/[slug]`. Signed-out → safe sign-in `returnTo`; incomplete profile → onboarding. **No auto log/favorite/list on import.** The title page (`app/title/[slug]/page.tsx`) falls back to the server-only reader `getRealMediaBySlug` (`lib/supabase/media.ts`) so a materialized title resolves and the existing Log/Rate/Review/Favorite/Add-to-list actions work unchanged.

10. **External result UI + attribution.** `components/media/external-result-card.tsx` is provider-neutral (poster or graceful fallback; title/year/kind/creator when available; a `via TMDB` / `via Open Library` credit; **no fabricated Favalog rating/reviews**). An importable candidate shows an identity-only import form with a pending / no-double-submit state and safe errors; an existing candidate links to `/title/[slug]`; a signed-out visitor gets a safe sign-in link. `components/media/provider-attribution.tsx` renders the mandatory TMDB notice ("This product uses the TMDB API but is not endorsed or certified by TMDB.") plus a logo, and an Open Library credit/link, without implying endorsement. The in-repo TMDB logo asset (`public/tmdb.svg`) is the official "blue_short" horizontal mark retrieved 2026-08-31 from https://www.themoviedb.org/about/logos; the artwork is unmodified, with only non-rendering Adobe Illustrator editor metadata (the `data-name` layer labels, invalid SVG attributes) stripped so the markup validates. Approved image hosts added to `next.config.ts`: `image.tmdb.org` (`/t/p/**`) and `covers.openlibrary.org` (`/b/**`) only.

11. **Eventual embedding.** Materialization **never** synchronously calls OpenAI. A materialized title is **keyword-searchable immediately** (via the stored `search_tsv`) and remains **missing/stale for semantic embedding** until the guarded, owner-controlled `npm run embed:catalog` re-embeds it — the remote-write guard is never bypassed. Embedding is restricted to curated and Open Library sources per `lib/search/embedding-source-policy.ts`; TMDB titles are excluded.

12. **External query privacy boundary + operational event.** When federation is enabled, the raw user query **is sent to TMDB / Open Library** to fetch results; this is the deliberate cost of federated discovery. Favalog's own structured telemetry stays query-free: `lib/catalog/log.ts` gains a redaction-safe `catalog_materialize` event (`logCatalogMaterialization`) carrying **only** provider, operation, outcome, canonical resolution (`linked` / `existing` / `created` / `ambiguous`), a coarse latency bucket, retry count, and a safe error category — **never** raw query text, ids, title/slug, user email, credentials, descriptions, provider payloads, or vectors. (The shareable `?q=` URL still places the query in browser history and hosting request logs per platform configuration, as with local search.)

13. **TMDB Compliance Gate.** TMDB (search and import) is disabled by default via `TMDB_ENABLED=false` and must remain disabled in production until the owner confirms AI-use permission from TMDB; holding an API token is not proof of permission.

The canonical-identity **database foundation and server layer** were implemented and verified earlier (migration applies on a clean `supabase db reset`; the full pgTAP suite passes — 320 tests, including 43 new canonical-identity assertions; generated types regenerated; typecheck clean; catalog unit tests green). The user-facing **federated Explore UI, external-result presentation, and the end-to-end materialization Server Action flow are now wired** on top of that foundation (this session's vertical slice; documentation-only follow-up recorded here). Constraints remain unchanged: **hosted Supabase is not mutated**, **no Vercel variables are changed and nothing is deployed**, **no hosted import or re-embedding is performed**, migration `20260815120600` and its pgTAP are **local-only**, existing migrations are not edited, and RLS/grants/pinned search paths/provider validation/remote-write guards/no-env behavior are not weakened. Generative AI over external results remains **deferred**; external search results in Explore are now the only newly-wired external-facing surface (import buttons live only within these Explore sections).
