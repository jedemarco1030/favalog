# 0005 — Following feed derived from authoritative records

- **Status:** Accepted — implemented locally; migration `20260815120900` is **not** applied to hosted Supabase and the feed is **not** production-verified
- **Date:** 2026-09-13
- **Phase:** 4B.2 (Real following feed and honest Home activity)
- **Builds on:** [0001 — Supabase/PostgreSQL as the Favalog backend](0001-supabase-backend.md), [0002 — Authentication and onboarding](0002-authentication-and-onboarding.md)

## Context

Phase 4B.1 delivered a real follow relationship, but following someone changed
nothing a viewer could actually **see** beyond follower counts and access to
follower-only lists. Home, meanwhile, presented mock "From your circle"
activity next to fabricated "Trending this week", "Popular reviews", and
"Because you liked …" sections — claims no Favalog system could support.

The obvious "social feed" reflex is an event store: an `activity` table written
on every user action, optionally fanned out into per-follower timelines by a
queue. Before reaching for it, we inspected what the schema already guarantees:

- `public.diary_entries` (migration `20260805150300`) records `logged_at` (the
  user-chosen diary date) **and** an immutable `created_at`, plus `rating` and
  `is_revisit`. The `set_updated_at` trigger touches only `updated_at`.
- `public.reviews` (migration `20260805150400`) may link to a diary entry
  (`on delete set null`) and, when linked, must carry **no** rating — the diary
  entry is the rating source of truth. A review with no `diary_entry_id` is an
  independent, persistent record in its own right.
- `diary_entries`, `reviews`, `profiles`, and `follows` are all RLS
  **public-read** (`using (true)`) with owner-only writes (migration
  `20260805150700`).
- `public.set_follow` (migration `20260815120800`) established the security
  template for every social RPC.

In other words, the authoritative, RLS-governed records for "what the people I
follow have watched, read, and reviewed" already exist. The only thing missing
was a **selection**.

## Decision

**Derive the following feed at read time from the existing authoritative
records. Do not introduce an event store, fan-out-on-write, a queue, or any
snapshot of user content.**

Concretely:

1. **One narrow RPC.** `public.get_following_feed(p_limit,
p_cursor_created_at, p_cursor_source, p_cursor_id)` (migration
   `20260815120900`, the 29th) performs the `follows` join, the self and
   non-follow exclusion, the linked-review deduplication, the total ordering,
   the keyset seek, and the bounded limit **in SQL**. One bounded page crosses
   the boundary; the whole graph is never pulled into application memory.
2. **`SECURITY INVOKER` — no privilege escalation.** Because every source table
   is already public-read under RLS, the function needs no elevation.
   Following is an _additional selection condition_, never a bypass, and RLS
   remains an independent second boundary. Contrast this with
   `semantic_search`/`hybrid_search` in ADR 0003, where `SECURITY DEFINER` was
   the narrow, justified exception needed to read a private table.
3. **Viewer identity from `auth.uid()` only.** The signature accepts no viewer
   id, `EXECUTE` is revoked from `public`/`anon` and granted to
   `authenticated`, and an anonymous caller gets nothing.
4. **The diary entry is the activity unit.** A linked review is embedded into
   its diary item and only `diary_entry_id is null` reviews become their own
   items, so one real action is always exactly one card. The dedup lives in
   SQL, so pagination cannot defeat it.
5. **A unique total order:** `(created_at desc, source_rank asc, id desc)` with
   `source_rank` diary = 0, review = 1 — stable even for identical timestamps
   across source types — plus a row-comparison keyset seek.
6. **A versioned, opaque cursor that is a position, never authorization.**
   Every page re-derives `auth.uid()` and re-joins `follows`.
7. **Page one is server-rendered; further pages come from a Server Action**
   treated as a public endpoint.

## Consequences

### Positive

- **Edits and deletes propagate for free**, and nothing anywhere can retain a
  stale excerpt, because there is no copy of the content. This is a
  correctness property, not an optimization.
- **Unfollowing is immediate** — including between page one and page two —
  because eligibility is re-evaluated on every read rather than baked into a
  materialized timeline.
- **No new consistency surface.** An event store would need writing on every
  create/edit/delete, its own RLS, its own backfill, and its own repair story
  when it drifted from the truth. None of that exists to go wrong.
- **No new infrastructure.** No queue, no worker, no snapshot table, no extra
  operational runbook.
- **Security is inherited, not reinvented.** The same template as `set_follow`,
  with RLS still enforced independently.

### Negative / accepted trade-offs

- **Read cost scales with the number of accounts followed.** Two supporting
  indexes — `diary_entries (user_id, created_at desc, id desc)` and a partial
  `reviews (user_id, created_at desc, id desc) where diary_entry_id is null` —
  match the seek order so a page is an index scan per followed account. At
  Favalog's scale this is the right trade; at a very large follow fan-out it
  would not be.
- **No frozen snapshot.** Refreshing restarts at the newest activity. This is
  documented honestly rather than papered over, and we make no claim that
  already-delivered content can be remotely retracted.
- **No follow-time cutoff this slice.** Following exposes that account's
  existing eligible history through pagination.
- **Viewer-specific reads cannot be shared-cached**, so `/feed` and Home are
  rendered per request. They already were, because the auth DAL reads cookies.

### When this decision should be revisited

If derivation becomes too expensive — a large average follow count, a
high-volume write rate, or a need for cross-source ranking beyond
chronology — the honest next step is a precomputed timeline. That is a
deliberate future decision with real operational cost, not something to adopt
speculatively now.

## Alternatives considered

- **A generic `activity` event table.** Rejected: it duplicates records that
  are already authoritative, and it introduces the exact bug class the product
  requirements forbid — a retained, stale copy of edited or deleted content.
- **Fan-out-on-write into per-follower timelines.** Rejected: it buys read
  performance Favalog does not need yet, in exchange for a queue, a worker, and
  a permanent drift/repair problem, and it makes unfollowing an eventual
  operation instead of an immediate one.
- **Assembling the feed in application code** (fetch follows, then fetch each
  account's activity, then merge). Rejected: it crosses the boundary with far
  more data than one page, makes a correct keyset seek across two sources
  fragile, and would move an authorization-relevant join out of the database.
- **`SECURITY DEFINER` for convenience.** Rejected: unnecessary here, and it
  would trade an independent RLS boundary for nothing.
- **Building trending/likes/recommendations to justify Home's existing
  sections.** Rejected as out of scope; those sections were removed instead,
  and Home now makes only claims the system can support.

## Verification

- **pgTAP** (`supabase/tests/database/following_feed_rpc.test.sql`) covers
  anonymous rejection, `prosecdef = false` and the pinned `search_path`,
  viewer-identity enforcement, follow direction, self and non-followed
  exclusion, RLS preservation, linked-review dedup, edit/delete behaviour,
  equal-timestamp ordering, cursor validation, limit clamping, and revocation
  across pages.
- **Vitest** covers the pure cursor (round trip, microsecond precision,
  rejection paths) and view model (verb derivation, diary-resolved rating,
  excerpt, combined vs standalone, `logged_at` display rule).
- **React Testing Library** covers the client list, the spoiler reveal, link
  safety, and each state.
- **Playwright** (`e2e/feed.spec.ts`, seeded local Supabase, loopback-guarded)
  covers the whole multi-user journey, including pagination without duplicate
  cards, a non-followed account never appearing, edit-then-delete propagation,
  unfollow revocation across pages, and no feed leakage when signed out or on
  another account.

All of the above pass locally. The migration has **not** been applied to hosted
Supabase, and nothing here has been verified in production.
