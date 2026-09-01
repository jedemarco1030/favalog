# Favalog product roadmap

> Living document. Last reconciled: 2026-09-01, against the verified production
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

These facts are the source of truth for reconciling other documentation. Where a
number differs between the local repository and hosted production, both are
stated explicitly.

- The hosted database has all **25 migrations through `20260815120600`** applied.
- The **local** curated catalog migration
  (`20260806160100_catalog_media_items.sql`) owns **28** curated titles.
- The **hosted production** catalog contains **29** titles: the 28 curated
  titles plus the imported Open Library Work `OL893414W`, which resolves to the
  canonical **Dune** title via on-demand materialization.
- The compatible OpenAI embedding corpus in production contains **29** documents
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
- **No-environment resilience** — the app builds and renders with no Supabase or
  provider environment variables; curated demo content is clearly labelled as an
  example catalog and never presented as live production activity.

## Remaining gaps

- Most consumer product pages (Home, community reviews) still render from the
  `@/lib/data` mock layer rather than real Supabase reads.
- No social graph yet: follows, follower-aware list visibility, likes on
  reviews/lists, and notifications are all still absent or mock.
- No games surface.
- No personalized recommendations; discovery is retrieval-only, not
  personalized or generative.
- Light/dark/system theming is implemented and verified in the repository
  (2026-09-01) but is not yet deployed to production; hosted production remains
  dark-only until the next deploy.
- Explore now has a real server-backed global _browse_ mode (media-type + genre
  filters, five global sorts, bounded pagination, shareable validated URL state)
  over the real `public.media_items` catalog, alongside the existing hybrid
  _search_. It is implemented and verified in-repo (2026-09-01) but not yet
  deployed to production, and gracefully degrades to the labelled example
  shelves when Supabase is unconfigured.
- Growth, monetization, and portfolio-packaging work has not started.

## Agreed phase sequence

1. **Product Reality and Discovery UX** — real server-backed catalog browsing,
   sorting, filtering, pagination, theming, and truthful documentation.
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

## Explicit non-goals for the current phase (Phase 1 — Product Reality)

The current phase deliberately excludes:

- Migrating Home, community reviews, follows, likes, notifications, games, or
  recommendations off mock data.
- Any social graph work (follows, follower-aware visibility, likes,
  notifications).
- Games, generative AI (LLM-written text/chat/agents), billing/monetization,
  background queues, Kubernetes, or new catalog providers.
- Enabling TMDB or adding TMDB titles to the OpenAI embedding corpus.
- Any hosted mutation, Vercel variable change, deployment, or production
  re-embedding.
- Drag-and-drop / arbitrary reordering, curator notes, or a follows UI.

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
