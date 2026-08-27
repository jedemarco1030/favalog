<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Favalog agent guide

This is the authoritative development guide for all coding agents working in
this repository. `CLAUDE.md` intentionally just points here (`@AGENTS.md`) so
every agent follows the same instructions. Keep instructions here — do not
duplicate them into `CLAUDE.md`.

Before substantial changes, review `README.md`, `package.json`, and the
relevant existing routes, components, types, data selectors, tests, and
stories.

## Product

**Favalog** is a social entertainment platform for tracking, rating,
reviewing, organizing, and discovering movies, television, and books.

Long-term, a person's Favalog becomes a living record of the entertainment and
interests they love. The current MVP scope is movies, TV, and books; they are
media types within shared experiences, **not** separate top-level products.

- Production preview: https://favalog.vercel.app
- Preserve the Favalog name and product language. Do not reintroduce the
  former "Lorely" name or any obsolete deployment URLs.

## Stack

From `package.json`:

- Next.js 16 App Router (application framework and build system, via Turbopack)
- React 19
- TypeScript, strict mode
- Tailwind CSS v4 with the existing CSS design tokens
- React Server Components by default
- `lucide-react` for interface icons
- a typed mock-data layer behind `@/lib/data` (`@/*` import alias)
- deployed on Vercel

Quality stack:

- ESLint, Prettier
- Vitest, React Testing Library, `@testing-library/jest-dom`,
  `@testing-library/user-event`
- Playwright
- Storybook with the accessibility addon (`@storybook/addon-a11y`)
- Husky + lint-staged
- GitHub Actions

Build-system rules:

- Next.js / Turbopack remains the application framework and build system.
- Vitest may use Vite tooling internally; that does not make this a Vite app.
- Do **not** convert the application itself to Vite.
- Do **not** add Jest or Cypress unless the project explicitly changes strategy.

## Architecture

- Prefer React Server Components.
- Add `"use client"` only where browser interaction genuinely requires it.
- Do not convert whole pages or layouts into Client Components just to add a
  small interactive control; isolate interactivity in a focused child.
- Avoid unnecessary `useEffect`, `useState`, global state, and client JavaScript.
- Preserve strict TypeScript. Never use `any` unless explicitly justified.
- Do not suppress TypeScript or ESLint errors.
- Use semantic HTML and accessible interactions.
- Use `next/image` where appropriate.
- Avoid unnecessary dependencies and speculative abstraction.
- Keep components focused and reusable; do not rebuild working components
  without a clear reason.

## Domain & data

- `MediaItem` (`lib/types.ts`) is a discriminated union of `Movie | TVShow |
Book`. Keep shared fields in `MediaItemBase`; keep media-specific fields in
  their correct subtype. Do not flatten every media property into one giant
  optional interface.
- Build cross-media UI once against the union and narrow on `kind`; avoid
  parallel movie / TV / book implementations.
- Media and lists carry stable `slug`s in the domain/data layer, distinct from
  mutable display titles. Do not derive route slugs from display titles inside
  UI components.
- Users carry a stable `username` (distinct from the mutable `displayName`);
  `/profile/[username]` routes off it. Do not derive usernames from display
  names inside UI components. Keep stored identity fields separate from derived
  profile statistics (which come from diary/reviews/lists via `@/lib/data`).
- Current data is deterministic mock data. Keep storage and query logic behind
  `@/lib/data`; UI components and routes must not read or recreate hard-coded
  catalog arrays. Add or update typed selectors in the data layer instead.
- Reference related entities by stable IDs (`mediaId`, `reviewId`, `mediaIds`)
  rather than duplicating whole objects.
- Do not introduce database/repository/service abstractions before they are
  justified.

Current primary routes:

- `/`
- `/explore`
- `/diary`
- `/lists`
- `/list/[slug]`
- `/title/[slug]`
- `/profile/[username]`

Do not add separate top-level routes such as `/movies`, `/tv`, or `/books`
without an explicit product decision.

## Backend & database (Supabase)

A Supabase/PostgreSQL foundation exists under `supabase/` and `lib/supabase/`.
The consumer-facing UI still runs on the `@/lib/data` mock layer; do not migrate
it to Supabase without an explicit task. The following rules are permanent:

- SQL migrations under `supabase/migrations/` are the single source of truth for
  the database schema. Never edit a live database out of band; every schema
  change is a new migration.
- Row Level Security must be enabled on every public application table, with
  explicit least-privilege policies. Never add `using (true) with check (true)`
  policies for user-owned writes, and never rely on hidden UI as authorization.
- Browser code must never receive privileged credentials. Only public
  `NEXT_PUBLIC_` Supabase config may reach the client; the secret/service-role
  key, database password, and privileged connection strings are server-only and
  must not be required for normal app startup or static build.
- Generated database types (`lib/database.types.ts`, via `npm run supabase:types`)
  are the DB representation only. They do not replace the framework-agnostic
  domain types in `lib/types.ts`; map between them at a boundary
  (`lib/supabase/mappers.ts`).
- Database changes require the relevant migration plus meaningful database tests
  (pgTAP under `supabase/tests/`) covering constraints and RLS.
- Use the current `@supabase/ssr` patterns (browser client, per-request server
  client, `proxy.ts` session refresh). Never use the deprecated
  `@supabase/auth-helpers-*` packages, and never create a shared global server
  client.

### Authentication & authorization (permanent rules)

- Treat every Server Action and Route Handler as a public endpoint. It must
  authenticate and authorize independently — re-validate the current user via
  the server-only auth DAL (`lib/auth/data.ts`) and rely on RLS as a second
  layer. The proxy is only an optimistic UX redirect, never the security
  boundary.
- Never trust client-provided ownership identifiers (hidden `userId`/`id`
  fields, etc.). Scope every user-owned write to the authenticated
  `auth.uid()` in both application code and RLS.
- Determine the authenticated user with Supabase's validating
  `supabase.auth.getUser()` for authorization decisions — never with the
  unverified `getSession()` cookie contents.
- Safe return-to validation is mandatory: route every caller-supplied redirect
  target through `getSafeRedirectPath` (same-origin relative paths only).
- Auth UI must work through SSR cookies (`@supabase/ssr`), read on the server —
  never via a client-side `localStorage`/session check that causes an auth
  flash. Do not leak raw Supabase errors or unvalidated query params to the
  browser; map them to safe messages, and keep account-existence neutral in
  sign-up and password-reset flows.

## Design

Favalog's visual direction is: dark-first, premium, editorial, cinematic,
social, content-first, and artwork-forward — restrained violet/coral accents,
warm off-white typography, and subtle borders and motion.

Avoid: SaaS dashboard styling, admin-panel layouts, generic AI-startup visuals,
excessive gradients, excessive glassmorphism, pill-shaped everything, direct
Letterboxd or Goodreads imitation, and a generic component-library demo look.

Respect the existing responsive behavior, semantic structure, focus states, and
accessibility conventions.

## Quality standard for new features

Not every component needs every kind of test. Choose coverage by behavior and
risk:

| Change                                                          | Expected coverage                |
| --------------------------------------------------------------- | -------------------------------- |
| Deterministic domain/data/selector/filtering/formatting logic   | Vitest unit tests                |
| Interactive or conditionally rendered Client Component behavior | React Testing Library            |
| Reusable visual component with meaningful states or variants    | Storybook stories                |
| Critical or materially changed user flow                        | Playwright                       |
| Bug fix                                                         | A regression test when practical |

- Prefer behavior-based tests and accessible queries (roles, labels, names,
  visible output).
- Avoid meaningless assertions, testing implementation details, excessive
  snapshots, arbitrary waits, fragile CSS selectors, test-only IDs where
  semantic queries work, and duplicate tests that add no confidence.
- Verify Server Components through their underlying data/domain logic (Vitest)
  and route behavior (Playwright). Do not distort the production architecture
  just to make Server Components easier to unit-test.
- Stories should demonstrate genuine reusable states (empty, loading, error,
  long-content, responsive, interactive) when those states exist.

## Validation

Use the repository scripts rather than one-off custom commands.

Available commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run build-storybook
npm run test:e2e
npm run validate       # format:check + lint + typecheck + test
npm run validate:full  # validate + build + test:e2e
```

For normal feature work, run at minimum:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Also run:

- relevant Playwright tests (`npm run test:e2e`) when user flows change;
- `npm run build-storybook` when shared components or stories change;
- `npm run test:coverage` when tests or significant domain logic change.

Run `npm run validate:full` when the change affects routes, application
integration, production rendering, or critical end-to-end behavior and the
environment supports Playwright.

Do not weaken lint rules, TypeScript strictness, coverage thresholds,
accessibility expectations, or CI checks merely to make a change pass. Do not
claim a command passed unless it was actually executed successfully.

## Scope / product behavior

Most consumer-facing product pages remain frontend/mock-data based, but the
full persistent diary-entry lifecycle is now real. A Supabase backend foundation
exists (schema, RLS, clients) and the following are wired to it:

- **Authentication + onboarding** (sign in/up, email confirmation, password
  reset, optional Google OAuth, session-aware shell, `/onboarding`).
- **Title logging (create).** On `/title/[slug]`, a signed-in, onboarded user
  can **Log / Rate / Review**; all three open one accessible dialog and persist
  through the `logTitleAction` Server Action (`app/title/[slug]/actions.ts`) →
  the atomic `public.log_media(...)` RPC (`lib/supabase/log.ts`). Rate creates
  a diary entry; Review creates a diary entry with a linked review. Signed-out
  users see a neutral **Log** primary action (never a personalized
  "Watched"/"Read") and route through the safe sign-in `returnTo` flow.
- **Edit / delete of logs.** The owning user can edit an existing diary entry
  and its optional linked review (add/update/remove, clear rating) via
  `public.update_diary_entry(...)`, and delete an entry (with its linked review,
  no orphan) via `public.delete_diary_entry(...)` — both `SECURITY INVOKER`,
  ownership from `auth.uid()`, `authenticated`-only EXECUTE. The
  `editDiaryEntryAction` / `deleteDiaryEntryAction` Server Actions
  (`app/diary/actions.ts`) back owner-only controls on the title personal state
  (`MediaActions`) and each real diary row (`DiaryEntryActions`), reusing the
  shared `LogDialog` (edit mode) and `DeleteLogDialog`. All three surfaces
  (`/diary`, `/title/[slug]`, the owner's `/profile/[username]`) revalidate
  after every create/edit/delete.
- **Real reads.** The title page shows the viewer's personal state
  (`getMyLatestLogForSlug`), `/diary` renders the authenticated user's real
  diary (`getMyDiary`) while signed-out/no-env visitors see a clearly labelled
  **example diary** (no edit/delete controls), and a real `/profile/[username]`
  shows derived stats / recently watched-read / real reviews
  (`getRealProfileActivity`). A diary-linked review's displayed rating resolves
  from its diary entry.
- **Persistent list lifecycle (create / add-title / remove-title / edit
  metadata / delete whole list) — wired end-to-end.** The full loop is now
  real: sign in → create a list → add a title → view the real list → see it on
  the owner's profile → add/remove titles → **edit list metadata** → **delete
  a whole list**. `public.create_list` / `add_list_item` / `remove_list_item`
  (migrations `20260814160000` global-unique slug index + `20260814160100`
  RPCs) and `public.update_list` / `public.delete_list` (migration
  `20260814160200_edit_delete_list_rpcs.sql` — the **17th**, now **hosted and
  production-verified**) follow the same security model as the diary RPCs
  (`SECURITY INVOKER`, pinned
  `search_path = ''`, ownership from `auth.uid()`, `authenticated`-only
  EXECUTE, identifier-only returns). Slugs are generated server-side and are
  globally unique + **immutable** (edit never renames the URL); only
  `public`/`private` visibility is accepted on create and edit
  (`ListVisibility` is reconciled to the enum `public | followers | private`,
  with `ListCreateVisibility = public | private`; stored `followers` maps to
  `private` in the edit form via `toCreateVisibility`). The server layer
  (`lib/supabase/lists.ts` writes + reads, `lib/supabase/list-input.ts`,
  `list-errors.ts`, `list-view-model.ts`) and Server Actions
  (`app/lists/actions.ts` including `editListAction` / `deleteListAction`,
  `app/lists/list-form.ts`) back UI under `components/lists/`
  (`real-list-card.tsx`, `create-list-dialog.tsx`, `add-to-list-dialog.tsx`,
  `remove-list-item-dialog.tsx`, `edit-list-dialog.tsx` / `edit-list-form.tsx`,
  `delete-list-dialog.tsx`, `real-list-owner-actions.tsx`,
  `real-list-detail.tsx`, `real-lists-sections.tsx`, and their pure helpers).
  Owner-only **edit** covers title / description / visibility
  (`public`|`private`) / ranked; a successful edit keeps the user on the
  immutable canonical `/list/[slug]` and refreshes. Owner-only **delete** uses
  a deliberate confirmation naming the list (checkbox-gated) and
  authoritatively redirects to `/lists` on success — the former list URL
  correctly becomes not-found; commit `53eac02` fixed the client-navigation
  race. `list_items` cascade via FK `ON DELETE CASCADE` (no orphan). Both
  revalidate `/lists`, the affected `/list/[slug]`, the owner's
  `/profile/[username]`, and every member `/title/[slug]` (add-to-list
  membership UI). On `/title/[slug]`, **Add to list** is real: signed-out → a
  sign-in link through the safe `returnTo` flow; signed-in + onboarded → a
  dialog (`getMyListsWithMembership(slug)`) with idempotent add/remove toggles
  per owned list, an inline create-list that creates and adds the title
  atomically, and a controlled unavailable state for unknown catalog slugs or
  read errors. `/lists` is server-first with a "Create list" launcher plus
  real "Your lists" (`getMyLists`, public + private) and strictly-`public`
  "Community lists" (`getPublicLists`) sections alongside clearly-labelled
  curated examples. `/list/[slug]` resolves a real list first
  (`getRealListBySlug`), falling back to mock demonstration lists, with
  owner-only per-item **Remove from list** confirmation, owner-only edit/delete
  list controls (never shown to signed-out visitors, non-owners, or mock-list
  viewers), and no faked like counter. Real profiles show a real **Lists**
  section and count (`getRealListsForUser`, public-only for visitors, all for
  the owner via RLS). Reads stay in server-only modules; Server Actions are
  injected into presentational components (Storybook never imports
  `"use server"`); no client-side Supabase, `localStorage` membership, or
  `getSession`-based rendering.
- **Persistent favorites lifecycle (favorite / unfavorite a title) — wired
  end-to-end.** The full loop is now real: sign in → favorite a title → see
  the ordered shelf on the owner's real profile → unfavorite. The atomic
  idempotent `public.set_favorite(p_media_slug, p_is_favorite)` RPC (migration
  `20260814160300_set_favorite_rpc.sql` — the **18th**, now **hosted and
  production-verified** via commit `d91894e`) follows the same
  security model as the diary and list RPCs (`SECURITY INVOKER`, pinned
  `search_path = ''`, fully schema-qualified, ownership from `auth.uid()`
  only — no client `user_id`/`media_id`/`username`/`position`/ownership
  fields, trusted catalog identity resolved server-side from
  `media_items.slug`, `authenticated`-only EXECUTE with EXECUTE revoked from
  `public`/`anon`, identifier-only returns). It rejects unauthenticated
  callers (28000), a null/invalid desired state (22023), and an unknown media
  slug (P0002); RLS stays an independent boundary and position changes are
  serialized by locking the caller's own `profiles` row. Adding an existing
  favorite and removing an absent one are both idempotent successes; new
  favorites append at the next contiguous zero-based position, and removal
  compacts remaining positions to a contiguous `0..n-1` range without
  transient unique-index collisions. The RPC returns only
  `{ favorite_id, media_id, slug, position, is_favorite, changed }` (never
  profile details). Backed by the `public.favorites` table (pre-existing
  migrations `20260805150600` + `20260805150700`) with unique
  `(user_id, media_id)` and `(user_id, position)`, RLS is **public-read**
  (`using (true)`) with owner-only authenticated writes — so favorites appear
  on real profiles for any visitor. The server layer
  (`lib/supabase/favorites.ts` reads + write, `lib/supabase/favorite-input.ts`
  validation, `favorite-errors.ts` safe mapping, `favorite-view-model.ts` pure
  row→view-model embedding a full `MediaItem` via `mapMediaRowToDomain`,
  ordered by position) and Server Action (`setFavoriteAction` in
  `app/title/[slug]/actions.ts` with `app/title/[slug]/favorite-form.ts`) back
  a presentational, action-injected `components/media/favorite-button.tsx`
  (Heart icon, `aria-pressed`, pending/disabled state preventing duplicate
  submissions, controlled error/unavailable state, server-truth state that
  never contradicts the write). `setFavorite` re-checks auth + onboarding via
  the auth DAL, treats a missing/malformed success contract as failure, and
  reports a controlled `unavailable` state when Supabase is not configured; the
  action routes signed-out/expired sessions through the safe sign-in `returnTo`
  flow and incomplete profiles to onboarding, returning the actual
  server-resolved state (never optimistic). It is wired into
  `components/media/media-actions.tsx`: signed-in users get the real toggle,
  signed-out visitors get a neutral **Favorite** sign-in link (never a
  personalized "Favorited"), and the account-required note mentions favoriting.
  The title page (`app/title/[slug]/page.tsx`) loads favorite state on the
  server for authenticated viewers (`getMyFavoriteState`), and
  `components/user/real-profile.tsx` renders a real **Favorites** section
  (`getRealFavoritesForUser`, ordered by position, cross-media `MediaCard`s
  linking to `/title/[slug]`, honest owner/visitor empty states, controlled
  read-error state, real catalog rows only). Every write revalidates the
  affected `/title/[slug]` and the authenticated owner's `/profile/[username]`
  (username from the auth DAL, never the client). Mock demo profiles keep their
  existing mock favorites; a real profile never inherits mock data.
- **AI Discovery v1 — hybrid catalog search (retrieval, NOT generative) —
  wired.** `/explore` keeps its editorial mock shelves (labelled examples) and
  adds real `media_items`-backed search over the **28** curated titles with a
  shareable `?q=` URL and movie/TV/book filters. Two signals are fused: Postgres
  full-text search (lexical, a STORED `search_tsv` + GIN index on the public
  catalog) and pgvector cosine (semantic) via **Reciprocal-Rank Fusion**
  (`k = 60`) with **exact-title protection** and a **semantic relevance cutoff**
  (maximum cosine distance `0.72`, minimum similarity ≈ 0.28) so typing a title
  always returns that title first and low-quality semantic matches are rejected.
  Five forward-only migrations after
  `20260814160300` (`20260815120000` catalog enrich + `search_tsv`/GIN,
  `20260815120100` private `media_search_documents` + pgvector,
  `20260815120200` search functions, `20260815120300` provenance-guarded
  search, and `20260815120400` semantic similarity cutoff — the **23rd**
  migration). All 23 migrations through `20260815120400` are **applied to
  hosted Supabase** (the migration ledger contains them). **Security
  model:** the private embedding
  table has RLS enabled with **no** policies and `anon`/`authenticated` revoked
  (raw vectors never leave the server; only `service_role` writes it);
  `keyword_search` is `SECURITY INVOKER` (public catalog), while
  `semantic_search`/`hybrid_search` are `SECURITY DEFINER` — the narrow,
  justified exception to read the private table — hardened with a pinned empty
  `search_path`, full schema-qualification, no dynamic SQL, clamped read-only
  limits, safe-field-only returns, EXECUTE revoked from `public` and granted to
  `anon`+`authenticated`; untrusted query text goes only through
  `websearch_to_tsquery`. **Provenance-guarded semantic retrieval:** migration
  `20260815120300` drops the old unguarded `semantic_search` / `hybrid_search`
  overloads and recreates them taking the **server-supplied** expected
  provenance (`provider`, `model`, `dimensions`, `document_version`) so the
  semantic arm only considers stored rows whose provider/model/dimensions/
  document-version match all four (the same embedding space as the query) and
  that carry a complete vector; it also adds
  `compatible_embedding_count(provider, model, dimensions, document_version)` so
  the app can cheaply detect a missing/partial/stale/incompatible corpus. The
  expected provenance comes from the server (config constants +
  `CANONICAL_DOCUMENT_VERSION`), never from browser input. Embeddings use OpenAI
  `text-embedding-3-small` at `dimensions: 512` behind an `EmbeddingProvider`
  interface (`lib/search/`), with a deterministic `FakeEmbeddingProvider` for
  tests/eval and a server-only adapter using the official `openai` SDK (behind
  the provider seam; imported only in server code, so client bundles are
  unaffected). The bulk pipeline treats a stored row as **unchanged** only when
  content hash, document version, provider, model, dimensions, and a complete
  embedding all match the current run — so a later real OpenAI run auto-re-embeds
  rows left by the fake provider; `--force` on `npm run embed:catalog` is a
  recovery escape hatch, not a substitute. Writing embeddings to a **hosted**
  Supabase project is guarded: `scripts/embed-catalog.mjs` classifies the
  resolved Supabase URL as local vs remote and, for a remote target, always
  rejects a `--fake` write (even with `--force`) and rejects a live write unless
  the operator explicitly passes **both** `--allow-remote` and
  `--confirm-project-ref=<exact-ref>` matching the resolved URL; `--force` never
  bypasses this and remote dry runs stay write-free. `OPENAI_API_KEY` is
  server-only (never `NEXT_PUBLIC_`, never logged), and a server-only
  `SEMANTIC_SEARCH_ENABLED` **kill switch** disables semantic while keyword keeps
  working. **Fallback:** `lib/supabase/search.ts` calls
  `compatible_embedding_count` **first**; with no compatible corpus it stays
  keyword-only, does **not** pay for a query embedding, and records mode
  `keyword_fallback` with reason `incompatible_corpus`. Otherwise it generates
  one trusted query embedding
  server-side with a 2500 ms timeout; on timeout/failure/disabled/unconfigured it
  returns keyword results (mode `hybrid` | `keyword` | `keyword_fallback`) and
  never fails the page — and it never claims `hybrid` unless a compatible
  semantic corpus was actually used, and with Supabase entirely unconfigured the
  no-env
  public browsing is preserved. No LLM-generated text, no raw similarity scores
  shown, no client-supplied vectors/weights/model/dimensions/SQL, and raw query
  text is never persisted (logs carry length/mode/latency/category only). An
  offline eval harness (`npm run eval:search`, plus `npm run embed:catalog`)
  measures Recall@5 / MRR / exact-title top-1 / positiveZeroResultRate /
  negativeCleanRate with a nonzero exit on regression and **fails closed** in
  `--live` mode (it verifies every catalog title has a matching
  provider/model/dimensions/document-version embedding and exits nonzero before
  evaluating if any fake/stale/incomplete/incompatible vector remains). Its
  deterministic (fake) mode is a **secret-free integration/regression** check of
  the retrieval plumbing, **not** proof of semantic relevance; only a genuine
  `--live` OpenAI run is evidence of semantic quality.
  **Final live metrics (local, 28-title catalog, 2026-08-25):** Recall@5 0.921,
  MRR 1.000, exact-title top-1 1.000, positiveZeroResultRate 0.000,
  negativeCleanRate 0.800 (hybrid). Keyword baseline: Recall@5 0.658, MRR 0.737,
  exact-title top-1 1.000, positiveZeroResultRate 0.263, negativeCleanRate 1.000.
  Threshold check: PASS. **Production state (2026-08-27):** all 23 migrations
  through `20260815120400` are hosted, and commit `2c9ab54` is deployed to
  Vercel production. However, the **hosted embedding corpus is empty** — an
  accidental hosted fake-embedding write was cleaned up, and the expected state
  (subject to read-only count verification) is zero rows in
  `media_search_documents`. Because there are no compatible hosted vectors,
  **production semantic retrieval is not yet enabled/verified**; production
  serves keyword-only results via the compatible-corpus fallback. Local live
  evaluation (above) remains the documented evidence of semantic quality.
  Enabling production semantic search is an owner-controlled step: run the
  guarded remote backfill (`npm run embed:catalog -- --allow-remote
--confirm-project-ref=<ref>` with `OPENAI_API_KEY` set) and re-verify. See
  [ADR 0003](docs/adr/0003-ai-discovery-hybrid-catalog-retrieval.md) and
  [`docs/ai-discovery-system-card.md`](docs/ai-discovery-system-card.md).

Everything else is still mock-data. Do **not** introduce any of the following
without an explicit task: migrating the remaining product pages off mock data,
**drag-and-drop / arbitrary reordering** (including arbitrary favorite
reordering and direct favorite-removal controls on the profile — favorite
removal is from the title page only this phase), **curator notes**, a follows
UI, likes (reviews or lists), follower-aware list visibility, external catalog
APIs (TMDB, Open Library, Google Books), **generative AI** (LLM-written text,
explanations, chat, or agents — AI Discovery v1 is retrieval only) and any AI
beyond the wired hybrid catalog search, real notifications,
real social relationships, real recommendation algorithms, additional OAuth
providers, MFA/passkeys, or full account settings. Mock demo usernames
(`jamie`, `mira`, …) still render their full mock profiles; other usernames
resolve through Supabase; unknown ones `notFound()`. A real profile never
inherits mock data (including mock lists).

## Workflow

Before coding:

1. Inspect existing types, components, data selectors, tests, and stories.
2. Prefer extending established patterns.
3. Confirm whether an existing abstraction already solves the problem.
4. Read the bundled Next.js docs (`node_modules/next/dist/docs/`) when
   framework behavior is uncertain.

After coding:

1. Review changed files.
2. Remove obsolete or duplicated code.
3. Add meaningful tests/stories per the quality policy above.
4. Run the appropriate validation commands.
5. Summarize files changed, architectural decisions, tests added, and
   validation results.

## Definition of done

A change is complete when:

- it follows the existing architecture and Favalog product language;
- domain types and the mock-data boundary remain coherent;
- responsive and accessible behavior is preserved;
- appropriate tests and stories have been added or updated;
- relevant documentation is updated when commands, architecture, routes, or
  conventions change;
- the applicable validation commands pass.
