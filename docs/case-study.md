# Favalog: engineering case study

Favalog is a cross-media record for movies, TV, books, and video games. You
discover a title, save it to a list, log it in a diary, review it, and share
it with the people who follow you. This document covers the engineering
decisions behind it and the evidence for each claim. It does not claim
anything that isn't verified in code, CI, or owner-confirmed production
behaviour.

## The problem

Entertainment trackers usually split by medium: one app for films, one for
books, one for games. Favalog treats media type as a property of a title,
not a separate product. The hard part is the catalog. No single provider
covers every medium, provider ids are unstable across providers, and copying
whole provider catalogs into a database is both expensive and, for some
providers, contractually restricted.

## Key decisions

**Discovery reads from providers; the catalog stores only what people use.**
TMDB, Open Library, and RAWG are read server-side through provider-neutral
adapters (`lib/catalog/`). A title enters the canonical catalog only when
someone saves, logs, or reviews it. The only write path is the `service_role`
RPC `materialize_media_item(...)`. It accepts an identity (provider plus
external id), never client-supplied metadata, and the server re-fetches and
normalizes the data itself. Aliases live in `media_external_ids`, so the same
title can't be imported twice. See ADR 0004.

**Row Level Security is the authorization layer, not the UI.** Every user
table has RLS. RPCs are `SECURITY INVOKER` and scoped to `auth.uid()`, and
every Server Action re-validates the user with `supabase.auth.getUser()`.
Follower-only list visibility is enforced in Postgres, and pgTAP tests cover
the policies. See ADRs 0001, 0002, and 0005.

**Hybrid search with honest degradation.** Explore fuses Postgres full-text
search and pgvector with Reciprocal-Rank Fusion, protects exact title
matches, and applies a semantic relevance cutoff. Embeddings run only for
providers whose terms permit it: RAWG is keyword-only and blocked in code
until its permission is documented. With embeddings unavailable, search
falls back to keyword-only rather than failing. See ADR 0003 and the AI
discovery system card.

**Failures are isolated per shelf.** Each discovery shelf fetches, caches,
and fails independently. A failing provider hides its own shelves and emits a
redacted, schema-versioned event (`docs/ai-discovery-operations.md`). The
page itself doesn't error.

**Save has staged writes, not overlapping client requests.** Saving materializes
the title, then adds it to a list. First-attempt traces reproduced the first-list
stall while two successive Server Actions refreshed streamed discovery. The
closeout combines creation and save into one server request with independent
authentication/authorization at the existing write gates. A partial failure
returns the created list; retry re-runs only save and never creates another list.
This is not a database transaction or a claim that network retries are atomic.
Signed-out viewers go through sign-in and return to the same card with the
picker open. Every return path is validated as a same-origin relative path.

## Verification

The sandbox has no Docker-backed local fixture stack; those browser journeys
run in CI. Read-only preview checks can also use v0's remote browser. A
successful compile is never treated as evidence of behaviour. CI verifies:

- Formatting, lint, strict typecheck, Vitest with coverage, a production
  build, and Storybook.
- pgTAP schema and RLS tests against a local Supabase stack, plus a
  generated-types drift check.
- Playwright default/no-env, seeded configured Explore, offline provider
  fixtures, production-refusal, following-feed, social, and likes jobs.
  Mutation-capable suites use isolated local Supabase, independent resets,
  and distinct ports. Each invocation has a machine-readable report and
  execution gate; failures, skips, and retried outcomes remain distinguishable.
- Fixture quality and portfolio capture require settled discovery, successful
  decoded artwork, and a materialized title record. Artwork is fulfilled
  locally before Next's optimizer can contact a provider CDN.

Tests never touch hosted production.

## Measured quality work (Phase 4E)

The quality pass was evidence-first. The first CI change only fixed the
evidence itself: two Playwright runs had been writing to the same report
directory, and the second overwrote the first, so the 12 baseline
measurements were silently missing. Once that was fixed and layout-shift
attribution was added, the baseline showed:

- 2 axe rule violations on each of Home, Explore (empty and searching), and
  the title page: muted-text contrast of about 3.3:1, a prohibited ARIA label
  on the star rating, and an `aria-controls` pointing at an element that
  wasn't always rendered.
- Desktop Explore CLS of 0.0897, which attribution traced to streamed
  discovery shelves pushing down the already-painted catalog browse.

In those historical runs, all four no-env pages reported 0 axe violations on
mobile and desktop. Moving discovery below the catalog produced desktop
Explore CLS 0, but sacrificed discovery-first presentation; that is not the
release solution. PR #21 restores provider shelves first inside a shared
loading boundary with downstream catalog content. Its navigation-start,
settled-state measurements are separate evidence, not a comparable speed
improvement claim. Desktop LCP differences of 20–40 ms in the historical runs
were within runner noise and are not claimed as improvements. Full numbers
and CI run links are in [`docs/quality/baseline.md`](quality/baseline.md).
These are lab measurements, not real-user data, and passing axe does not
establish accessibility compliance. The manual checks are listed in that
document.

## What's not done

- RAWG content is not semantically searchable. The pipeline is implemented and
  fixture-tested, but it stays off until RAWG permission is documented.
- Some community-review surfaces still use the labelled mock layer.
- Social and likes run in CI, but fixture evidence is not owner acceptance.
- The five latest observed catalog-refresh scheduled runs skipped the job;
  the GitHub activation gate and read-only rehearsal require owner verification.
- Real VoiceOver/NVDA, actual browser zoom, and manual artwork contrast remain
  owner checks. Axe incomplete findings are recorded, not called passes.
- [MVP 1 acceptance](mvp1-release-checklist.md) is still pending.
- No notifications, comments, blocking, or private accounts yet.

## How it was built

The project is built with AI assistance. The owner sets the requirements,
reviews and merges every PR, and confirms production behaviour. Each phase
shipped as small PRs with CI evidence attached rather than as one large
change.
