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
