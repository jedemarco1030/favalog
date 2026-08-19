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
  `20260814160200_edit_delete_list_rpcs.sql` — the **17th**, **local-only** /
  unverified on hosted Supabase until the owner deploys it) follow the same
  security model as the diary RPCs (`SECURITY INVOKER`, pinned
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
  a deliberate confirmation naming the list (checkbox-gated) and navigates to
  `/lists` on success; `list_items` cascade via FK `ON DELETE CASCADE` (no
  orphan). Both revalidate `/lists`, the affected `/list/[slug]`, the owner's
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

Everything else is still mock-data. Do **not** introduce any of the following
without an explicit task: migrating the remaining product pages off mock data,
**drag-and-drop / arbitrary reordering, curator notes**, favorites, a follows
UI, likes (reviews or lists), follower-aware list visibility, external catalog
APIs (TMDB, Open Library, Google Books), AI functionality, real notifications,
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
