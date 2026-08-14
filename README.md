# Favalog

> **Everything you watch and read. One place to remember it.**

Favalog is a social entertainment platform where people track, rate, review,
organize, and discover the movies, TV, and books they love. Long-term, a
person's Favalog becomes a living record of their taste — the things they
watch, read, and love, and eventually the games, music, and other interests
that make up their taste.

The current MVP scope is **movies, TV, and books**. A Supabase/PostgreSQL
backend foundation is in place: **authentication + onboarding** and the first
**persistent product loop — logging a title with an optional rating and
review** — are wired to it, and an authenticated user's **Diary** and
**Profile** now render real Supabase data. Everything else (catalog browsing,
lists, favorites, follows, community reviews) still renders from a typed
mock-data layer, and there is no external media API or AI yet. The app still
builds and runs with **no** Supabase environment variables set. The
architecture is designed so the remaining pieces can drop in without
rewriting the UI.

---

## Tech stack

| Concern    | Choice                                                   |
| ---------- | -------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, React Server Components)         |
| Language   | TypeScript (strict)                                      |
| UI         | React 19                                                 |
| Styling    | Tailwind CSS v4 with CSS design tokens                   |
| Icons      | `lucide-react`                                           |
| Fonts      | Inter (sans), Fraunces (editorial serif), JetBrains Mono |
| Linting    | ESLint (flat config, `eslint-config-next`)               |
| Formatting | Prettier (+ `eslint-config-prettier`)                    |
| Unit tests | Vitest + React Testing Library + jsdom                   |
| E2E tests  | Playwright (Chromium)                                    |
| Components | Storybook (`@storybook/nextjs-vite`) + a11y addon        |
| Git hooks  | Husky + lint-staged                                      |
| CI         | GitHub Actions                                           |

No component library, no CSS-in-JS runtime, no state manager. Interactivity
is opt-in via Client Components; every other component is a Server Component
by default.

---

## Project structure

```
app/                     App Router routes, layouts, and global styles
  layout.tsx             Root layout — fonts, metadata, header, footer
  page.tsx               Home page (hero collage, Trending this week, From your circle, Popular reviews, Because you liked …, and a Build your Favalog CTA)
  globals.css            Tailwind entry + design tokens
  explore/page.tsx       Explore — search, media-type filter, and editorial shelves
  diary/page.tsx         Diary — unified newest-first log of watched / read titles with a media-type filter
  lists/page.tsx         Lists — cross-media collection discovery index with curated sections and local search
  list/[slug]/page.tsx   Individual list/collection page, keyed by the stable `List.slug`
  title/[slug]/page.tsx  Unified movie / TV / book detail page, keyed by `MediaItem.slug`
  profile/[username]/page.tsx  A person's Favalog — profile experience keyed by the stable `User.username`
  not-found.tsx          Site-wide 404 for unmatched routes and `notFound()`

components/
  brand/                 Wordmark and brand-only assets
  layout/                Site header, footer, primary nav, mobile nav
  ui/                    Design-system primitives (Container, Badge,
                         StarRating, RatingDisplay, SearchInput,
                         SectionHeader, EmptyState, Skeleton)
  media/                 MediaCard, MediaPoster, MediaTypeBadge,
                         HorizontalMediaRow, MediaHero, MediaActions,
                         MediaDetails, RatingBreakdown
  activity/              ActivityCard used by the feed
  diary/                 DiaryTimeline, DiaryEntry, DiarySummary, and the
                         shared diary view-model/helpers
  lists/                 ListCard, ListPreviewCovers, ListItemRow, ListHeader,
                         ListActions, ListSection, ListsBrowser, and the
                         shared list view-model/helpers
  reviews/               ReviewCard
  user/                  UserAvatar, ProfileStats, ProfileHeader,
                         ProfileSection, FavoriteMediaGrid
  skeletons/             Media, activity/feed, and profile skeletons

lib/
  types.ts               Strongly typed domain models
  site-config.ts         Centralized brand name, tagline, and site URL
  cn.ts                  Class name joiner utility
  data/                  Mock data layer (users, media, activity, diary, lists, profile, index)

public/media/            Local SVG placeholder posters, backdrops, avatars

scripts/
  generate-placeholders.mjs   Regenerates the SVG placeholder artwork
```

### Data layer

The UI **never** reads hard-coded arrays. It imports from `@/lib/data`, which
is the sole entry point of the mock data layer. Replacing mock data with a
real API later means replacing that module — the domain types stay identical.

Every trackable title conforms to a shared `MediaItem` discriminated union
(`Movie | TVShow | Book`) so cross-media UI (feed, lists, search) can be built
once and reused.

---

## Backend (Supabase) — foundation + authentication

> **Current status: authentication + onboarding AND the full persistent
> diary-entry lifecycle (create + edit + delete) are implemented on top of the
> Supabase foundation; the rest of the product still uses mock data.** Sign up,
> sign in, email confirmation, password reset, Google OAuth (optional),
> session-aware navigation, and first-time profile onboarding are wired to
> Supabase Auth. On a title page a signed-in, onboarded user can **Log / Rate /
> Review** — each creates a diary entry (Review adds a linked review) through the
> atomic `public.log_media(...)` RPC. The owner can then **edit** that entry
> (via `public.update_diary_entry(...)` — including adding, updating, or removing
> its linked review, and clearing its rating) or **delete** it (via
> `public.delete_diary_entry(...)`, which also removes the linked review so no
> orphan remains) from both the title's personal-state area and each row of
> their real diary. That entry appears as the title's **personal state**, in the
> user's real **`/diary`**, and on their real **`/profile/[username]`** (derived
> stats, recently watched/read, and reviews); all three revalidate after every
> create/edit/delete. A diary-linked review stores its rating as `null` by
> design; its displayed rating resolves from the diary entry.
>
> Signed-out visitors see a neutral **Log** primary action (never a personalized
> "Watched"/"Read"), with Log/Rate/Review routing through the safe sign-in
> `returnTo` flow, and `/diary` shows a clearly labelled **example diary** (never
> presented as their own) with no edit/delete controls. The **persistent list
> loop** (create a list, add a title, remove a title — via
> `public.create_list` / `add_list_item` / `remove_list_item` with
> server-generated globally-unique slugs and `public`/`private` visibility) is
> **implemented and verified locally** at the database + server layer
> (`lib/supabase/lists.ts`, `app/lists/actions.ts`); wiring its Add-to-list
> dialog, real `/lists` / `/list/[slug]`, and profile surfaces is the **next
> slice**. **List editing/deletion/reordering/notes, favorites, follows, and
> likes remain deferred**, and the catalog / community reviews still render from
> the `@/lib/data` mock layer.
> The generated database types (`lib/database.types.ts`) are real and
> drift-checked, the catalog migration owns all **28** curated titles, and
> `seed.sql` references that catalog and remains **local only**. The app still
> builds and runs with **no** Supabase environment variables set — public
> browsing keeps working and the auth/logging entry points show a controlled
> unavailable state.
> See [Authentication & onboarding](#authentication--onboarding) below.

Full detail lives in [`docs/backend-architecture.md`](docs/backend-architecture.md)
and [`docs/adr/0001-supabase-backend.md`](docs/adr/0001-supabase-backend.md).

### Layout

```
supabase/
  config.toml           Supabase CLI project config
  migrations/           Version-controlled SQL — the schema source of truth
  seed.sql              Small deterministic local seed (movie/TV/book + relations)
  tests/database/       pgTAP tests for constraints + RLS
lib/
  database.types.ts     Generated DB types (regenerate via npm run supabase:types)
  supabase/
    env.ts              Safe, non-throwing env access + validation
    client.ts           Browser client (Client Components)
    server.ts           Per-request cookie-aware server client
    session.ts          Session-cookie refresh helper (used by proxy.ts)
    mappers.ts          DB row -> domain model boundary (+ profile mapper)
    profiles.ts         Public profile lookup selector (server-only)
  auth/
    data.ts             Server-only DAL: getCurrentUser/Profile, requireUser/…
    validation.ts       Pure input validation + normalization
    safe-redirect.ts    Same-origin-only return-to validation
    errors.ts           Supabase error -> safe user-facing messages
    capability.ts       Auth/Google availability detection
    profile.ts          Profile-completeness rule
    urls.ts             Trusted absolute-URL builder for callbacks/emails
app/
  auth/                 Sign in/up, forgot/update password, callback, confirm
  onboarding/           First-time profile completion (account-only)
proxy.ts                Root Proxy (Next.js 16) — session refresh + optimistic
                        /onboarding redirect (NOT the security boundary)
```

### Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and fill in the values. None
are required for the current mock-data app to build or run.

| Variable                               | Exposure        | Notes                                       |
| -------------------------------------- | --------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | browser+server  | Public project URL                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser+server  | Public publishable key (formerly "anon")    |
| `NEXT_PUBLIC_SITE_URL`                 | browser+server  | Optional canonical origin for callback URLs |
| `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED`  | browser+server  | Optional `"true"` to show Google sign-in    |
| `SUPABASE_SECRET_KEY`                  | **server only** | Privileged; future admin use; optional      |

Never expose the secret key, database password, or privileged connection
strings to browser code.

### Local setup

Requires **Docker** running. The Supabase CLI ships as a dev dependency.

```bash
npm run supabase:start     # start local stack (Postgres, Auth, Studio, …)
npm run supabase:status    # print local URLs + keys → paste into .env.local
npm run supabase:reset     # apply all migrations, then run seed.sql
npm run supabase:types     # regenerate lib/database.types.ts from local DB
npm run db:test            # run pgTAP schema + RLS tests
npm run supabase:stop      # stop the local stack
```

> `lib/database.types.ts` is **genuinely generated** from the local database by
> `npm run supabase:types` and is guarded by a secret-free drift check
> (regeneration must produce no diff). Regenerate it only when a migration
> actually changes the schema; never hand-edit it.

### Remote linking (later)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Remote/PR CI does **not** require Supabase credentials.

### Hosted verification status (2026-08-05)

The hosted development project was verified directly (read-only schema
introspection plus disposable-account auth flows over the Supabase client);
`supabase link`/`db push`/`gen types` could not be run here because the local
Docker stack was unavailable and no CLI access token was present.

- **Schema & migrations**: all 8 committed migrations are recorded in the
  remote `schema_migrations` ledger — no drift. All expected tables, both enums
  (`media_kind`, `list_visibility`), the `set_updated_at` + `handle_new_user`
  functions, the `on_auth_user_created` trigger, constraints (rating half-steps,
  self-follow prevention, duplicate list-item/username uniqueness), indexes, and
  **RLS on every table** are present and match the intended owner-write /
  public-read model.
- **Fix applied**: `handle_new_user()` cast `::citext` unqualified under a pinned
  empty `search_path`; because `citext` lives in the `extensions` schema this
  raised `type "citext" does not exist`, so **every** hosted sign-up failed with
  "Database error creating new user". Forward-only migration
  `20260805175500_fix_handle_new_user_citext_qualification.sql` qualifies the
  cast as `extensions.citext`. This is the exact path the local pgTAP trigger
  test exercises, so it also unblocks the CI `database` job.
- **Auth verified end-to-end** against the hosted project (disposable accounts,
  cleaned up): automatic profile creation via the trigger (id/username/
  display-name/timestamps), sign-in, wrong-password rejection, owner onboarding
  update, case-insensitive duplicate-username rejection, RLS cross-user-update
  block, and sign-out.
- **Still a placeholder**: `lib/database.types.ts` remains the hand-authored
  placeholder — genuine `supabase gen types` needs Docker or a CLI access token,
  neither available here. Regenerate and commit it from a Docker-capable
  environment or the CI `database` job.
- **Not exercised here** (require a browser / real email inbox / dashboard):
  the sign-up UI + email-confirmation link, browser session-restore-on-refresh,
  the recovery email link, the Google OAuth consent screen, and Vercel
  environment/deploy verification. Backend equivalents were verified above.

---

## Authentication & onboarding

Phase 2 wires Supabase Auth into the app shell and adds a first-time onboarding
flow. The rest of the product still renders from the `@/lib/data` mock layer;
**persistent** user actions (logging, rating, reviewing, lists) remain out of
scope. Everything degrades gracefully with no Supabase env: public browsing
works and the auth entry points show a controlled "accounts aren't available
yet" state.

### What's implemented

- Email/password **sign up** (display name, username, email, password) with
  server-side validation and a "check your email" confirmation state.
- Email/password **sign in** with a safe post-sign-in redirect.
- **Email confirmation** and **password reset → update** via token-hash
  verification (no deprecated implicit-flow fragments).
- **Google OAuth** (PKCE) — optional, shown only when configured.
- **Sign out**, session-aware header (signed-out controls vs. account menu).
- First-time **onboarding** to complete a username + display name.
- **Safe return-to** validation, and route protection for `/onboarding`.

### Auth routes

| Route                   | Kind          | Purpose                                        |
| ----------------------- | ------------- | ---------------------------------------------- |
| `/auth/sign-in`         | Page + Action | Email/password sign in (+ optional Google)     |
| `/auth/sign-up`         | Page + Action | Create account with profile metadata           |
| `/auth/forgot-password` | Page + Action | Request a reset email (neutral response)       |
| `/auth/update-password` | Page + Action | Set a new password (recovery context required) |
| `/auth/callback`        | Route Handler | OAuth/PKCE code exchange                       |
| `/auth/confirm`         | Route Handler | Email confirmation / recovery token verify     |
| `/onboarding`           | Page + Action | Complete profile (account-only)                |

Sign out is a Server Action invoked from the header account menu.

### Supabase dashboard configuration

For a hosted project (Authentication → URL Configuration, and Providers):

- **Site URL**: your canonical origin (e.g. `https://favalog.vercel.app`; locally
  `http://127.0.0.1:3000`).
- **Redirect URLs** (allow-list): `http://127.0.0.1:3000/**` for local, plus your
  production and any Vercel preview origins you want to permit, e.g.
  `https://favalog.vercel.app/**`. Prefer explicit origins over a broad wildcard;
  a wildcard trades safety for preview convenience.
- **Email templates**: point the confirmation and recovery links at
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/onboarding`
  (use `next=/auth/update-password` for the recovery template).
- **Google provider**: create OAuth credentials in Google Cloud, set the
  authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`,
  paste the client id/secret into Supabase, then set
  `NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED=true` to reveal the button. The client
  secret lives only in Supabase — never in this repo.

Local defaults live in `supabase/config.toml` (`[auth]` `site_url` +
`additional_redirect_urls`).

### Transitional profile behavior

`/profile/[username]` is intentionally hybrid during this phase:

- A **mock demo username** (e.g. `jamie`) renders the full mock profile exactly
  as before.
- A username that resolves to a **real Supabase profile** renders a minimal
  real identity (name, @handle, bio, location, join date) with honest empty
  states — a newly-registered user is **never** attributed a mock user's diary,
  reviews, or lists.
- Anything else is a genuine 404.

---

## Commands

```bash
npm install                # Install dependencies (also sets up Husky hooks)

# Development
npm run dev                # Start the dev server on http://localhost:3000
npm run build              # Production build
npm run start              # Serve the production build

# Static quality
npm run lint               # ESLint (code quality)
npm run typecheck          # TypeScript (tsc --noEmit)
npm run format             # Prettier — write
npm run format:check       # Prettier — check only

# Unit / component tests
npm run test               # Vitest (single run)
npm run test:watch         # Vitest (watch mode)
npm run test:coverage      # Vitest with coverage report

# End-to-end tests
npm run test:e2e           # Playwright against a production build
npm run test:e2e:ui        # Playwright interactive UI mode

# Component development
npm run storybook          # Storybook dev server on http://localhost:6006
npm run build-storybook    # Static Storybook build

# Aggregate gates
npm run validate           # format:check + lint + typecheck + test
npm run validate:full      # validate + build + test:e2e

# Supabase / database (require Docker; see the Backend section above)
npm run supabase:start     # Start the local Supabase stack
npm run supabase:status    # Print local URLs + keys
npm run supabase:reset     # Re-apply migrations, then run seed.sql
npm run supabase:types     # Regenerate lib/database.types.ts from the local DB
npm run supabase:stop      # Stop the local stack
npm run db:test            # Run pgTAP schema + RLS tests
```

To regenerate the placeholder artwork after editing the mock catalog:

```bash
node scripts/generate-placeholders.mjs
```

---

## Quality & testing

Favalog ships with a layered quality stack. Each tool owns one concern and
they are wired together so `npm run validate` is a reliable local gate.

| Tool                      | Role                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------- |
| **ESLint**                | Code quality (flat config, `eslint-config-next`)                                        |
| **TypeScript**            | Strict static types (`npm run typecheck`)                                               |
| **Prettier**              | Formatting only; `eslint-config-prettier` disables ESLint's overlapping stylistic rules |
| **Vitest**                | Unit + component test runner (jsdom, `@/*` alias via `vite-tsconfig-paths`)             |
| **React Testing Library** | Component testing via accessible queries (`@testing-library/jest-dom`, `user-event`)    |
| **Playwright**            | End-to-end user flows against the production build (Chromium)                           |
| **Storybook**             | Isolated component states, visual review, accessibility (`@storybook/addon-a11y`)       |
| **Husky + lint-staged**   | Pre-commit: Prettier + ESLint on staged files only                                      |
| **GitHub Actions**        | CI: format, lint, typecheck, unit tests, build, Storybook build, E2E                    |

### Testing strategy

- **Unit tests** cover deterministic domain/data logic in `lib/` — selectors,
  search matching, filtering, related-media, and rating math. These are the
  highest-value tests and are exercised directly (see `lib/**/*.test.ts`).
- **React Testing Library** covers interactive and conditional Client
  Components (Explore search/filter, Diary filtering, MobileNav, cards, and
  rating displays). Tests assert observable behavior through accessible
  queries — never internal state or class names.
- **Playwright** covers complete user journeys (home → explore → title,
  search, media-type filtering, movie vs. book detail, the custom 404, the
  diary, the lists flow — index → list → title, list search, and the
  invalid-list-slug 404, the profile flow — profile, derived statistics,
  favorite title, one of the user's lists, and the unknown-username 404, and
  the secret-free auth flow — signed-out header, sign-in/up/forgot pages render
  accessibly, the controlled no-config state, and `/onboarding` not being
  publicly reachable) against `next build` + `next start`, using semantic
  locators. Supabase-enabled auth E2E (real sign-up/in/onboarding) is a
  separate, gated concern requiring a disposable test project.
- **Storybook** documents genuine component states (media/review/activity
  cards, badges, ratings, empty states) on the Favalog dark theme and provides
  an accessibility panel for visual/a11y review.

Async App Router **Server Components** are intentionally _not_ forced into the
unit toolchain (Vitest does not support them cleanly). Their underlying data
logic is unit-tested and their rendered routes are covered by Playwright.

### Coverage

`npm run test:coverage` uses the V8 provider with thresholds of **70%**
statements / lines / functions and **60%** branches. Coverage is scoped (via
`vitest.config.mts` `coverage.include`) to the deterministic domain logic and
the interactive/conditional components that are actually tested, so the numbers
stay meaningful rather than diluted by purely presentational or
Server-Component-only surfaces (which are covered by Playwright instead).

### Contributing standard

New work should include quality coverage **where it adds real value** — the
rule is _not_ "every component needs a test and a story". Use this guide:

| Change                                         | Expected coverage              |
| ---------------------------------------------- | ------------------------------ |
| New deterministic business/domain logic        | Unit tests (Vitest)            |
| New interactive component                      | RTL tests                      |
| New reusable visual component with real states | Storybook stories              |
| New critical user flow                         | Playwright E2E                 |
| Bug fix                                        | Regression test when practical |

Do not add test-only IDs or snapshots to hit a number; prefer accessible,
behavior-focused assertions.

---

## MVP scope (current)

The current implementation covers the **application shell, shared UI layer,
and fully built Home, Explore, Diary, Lists, title-detail, list-detail, and
profile experiences**:

- Design system: dark-first tokens, editorial typography, accent color
- Root layout with deployment-aware SEO metadata and Open Graph tags,
  centralized in `lib/site-config.ts`
- Responsive top navigation: wordmark, primary nav, search field,
  notifications, a profile avatar linking to the current viewer's
  `/profile/[username]`, and a dedicated mobile sheet
- Reusable primitives: `Container`, `Badge`, `StarRating`, `RatingDisplay`,
  `SearchInput`, `SectionHeader`, `EmptyState`, `Skeleton`
- Media components: `MediaCard`, `MediaPoster`, `MediaTypeBadge`,
  `HorizontalMediaRow`, `ExploreDiscovery`
- Social components: `ActivityCard`, `ReviewCard`, `UserAvatar`,
  `ProfileStats`, `ProfileHeader`, `ProfileSection`, `FavoriteMediaGrid`
- Loading states: `MediaCardSkeleton`, `MediaRowSkeleton`,
  `ActivityCardSkeleton`, `FeedSkeleton`, `ProfileSkeleton`
- Typed domain models: `User`, `MediaItem`, `Movie`, `TVShow`, `Book`,
  `Review`, `Rating`, `List`, `ActivityItem`, `DiaryEntry`, `Favorite`,
  `CurrentlyEnjoying` (both `MediaItem` and `List` carry a stable `slug`,
  distinct from the display title; `User` carries a stable `username`,
  distinct from the display name)
- Mock data layer at `lib/data`
- Home page composed of a hero (with a mixed movie / TV / book collage),
  a unified **Trending this week** row, a **From your circle** social feed,
  a **Popular reviews** section, a **Because you liked …** cross-media
  recommendation preview, and a closing **Build your Favalog** CTA

### Primary navigation

| Route                 | Status                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | Implemented (home)                                                                                                                                                                                                                                |
| `/explore`            | Implemented — local search, All / Movies / TV / Books filter, editorial shelves                                                                                                                                                                   |
| `/diary`              | Implemented — unified newest-first diary of movies, TV, and books, grouped by month, with All / Movies / TV / Books local filtering and a derived activity summary                                                                                |
| `/lists`              | Implemented — cross-media collection discovery with curated sections (Popular, From your circle, Recently updated, Staff picks) and lightweight local search                                                                                      |
| `/list/[slug]`        | Implemented — individual collection page keyed by the stable `List.slug`, with mixed-media contents, ranks/notes, presentation-only Like/Share, and related lists                                                                                 |
| `/title/[slug]`       | Implemented — unified detail page for movies, TV, and books with adaptive credits, community rating breakdown, popular reviews, and cross-media "More like this"                                                                                  |
| `/profile/[username]` | Implemented — a person's Favalog profile keyed by the stable `User.username`: identity header, derived taste statistics, favorites, currently enjoying, recently watched/read, recent reviews, lists, and recent activity (e.g. `/profile/jamie`) |

Movies, TV, and books are **not** top-level destinations. They are media
types that will be filtered inside `/explore`.

### Explore

`/explore` is the primary discovery surface for movies, TV, and books.

- **Local search.** The interactive search field filters the mock catalog
  as the user types, matching against title, subtitle, the credit
  appropriate to each kind (director for movies, creators for TV,
  authors for books), and genre tags. The searchable "haystack" for each
  `MediaItem` is built in `lib/data` via `searchTermsFor` and pre-joined
  on the server so the Client Component never has to understand which
  discriminant carries which credit.
- **Media-type filter.** All / Movies / TV / Books, implemented as
  `aria-pressed` toggle buttons. `All` is the default. The filter also
  applies while a search query is active, so results always respect both
  axes.
- **Editorial shelves.** When no search query is active, Explore renders
  Trending now (mixed), Popular movies, Popular books, Popular
  television, Critically acclaimed, New & noteworthy, and Hidden gems.
  Every shelf is derived from the existing mock catalog via helpers in
  `lib/data` (`getTrendingMedia`, `getPopular*`, `getCriticallyAcclaimed`,
  `getNewAndNoteworthy`, `getHiddenGems`), which keeps the UI free of any
  storage-shape assumptions.
- **URL state.** Search and filter mirror to the URL as `?q=…&type=…`
  via a debounced `router.replace`. Sharing `/explore?q=dune&type=book`
  restores the same view; `type=all` is omitted so the default URL stays
  clean.
- **Server-first.** Only the search input, filter toggles, and their
  results grid are a Client Component (`ExploreDiscovery`). The page
  header and every editorial shelf render as Server Components using the
  shared `HorizontalMediaRow` and `MediaCard`.
- **Mock-data limitations.** The catalog is intentionally small; "trending"
  is a deterministic interleave, "popular" sorts by `averageRating`, and
  "hidden gems" is a curated id list in the data layer. All of these are
  drop-in replaceable once a real backend exists.

### Diary (`/diary`)

`/diary` is the personal, chronological record of everything a user has
watched and read. Movies, TV, and books share **one** newest-first timeline —
there are no per-kind diary routes.

- **Unified log-entry model.** A typed `DiaryEntry` (`lib/types.ts`) has
  stable identity and references media by `mediaId` and any review by
  `reviewId` — never embedding a full `MediaItem` or duplicating review
  bodies. Deterministic mock entries spanning several months of 2026 live in
  `lib/data/diary.ts` alongside selectors: `getDiaryEntriesForUser`,
  `getDiaryEntryMedia`, `getDiaryEntriesByType`, and `getDiarySummary`.
- **Derived activity summary.** The restrained summary strip (total logged
  this year plus a films / series / books breakdown) is computed from the
  diary itself via `getDiarySummary`, so the counts can never drift from the
  log. It is intentionally a single line, not a stats dashboard.
- **Month-grouped timeline.** Entries are grouped by month and ordered newest
  first. Each row shows the date, cover artwork, title, year, media type, the
  action taken (watched / rewatched / read / reread), the user's rating if
  present, and a small review indicator with a one-line excerpt when a review
  exists. Both artwork and title link to `/title/[slug]`. Dates are formatted
  with native `Intl.DateTimeFormat` — no date library was added.
- **Local media-type filtering.** All / Movies / TV / Books, implemented as
  `aria-pressed` toggle buttons (`All` is the default). Filtering runs
  entirely on the client against the already-resolved entries and mirrors to
  the URL as `?type=…` via `router.replace`; `type=all` is omitted so the
  default URL stays clean. Each empty filter shows concise copy
  (e.g. "No books logged yet.").
- **Server-first.** The page resolves every `DiaryEntry` into a flat,
  serializable view model on the server (looking up media and review by id),
  so the only Client Component (`DiaryTimeline`) filters the array it is given
  and never touches the data layer. The header, summary, and entry rows
  otherwise render as Server Components.
- **Responsive & accessible.** A single `h1`, month headings as `h2`, a
  responsive list/timeline (no wide desktop table) with compact artwork and a
  readable date rail on mobile, meaningful link names, `aria-pressed` filter
  state, visible focus rings, and screen-reader-friendly star ratings.

### Lists (`/lists` and `/list/[slug]`)

Lists let people organize and share **cross-media** collections of movies, TV,
and books. A single list may freely mix all three kinds — there is deliberately
no per-kind list system.

- **Typed list model.** A `List` (`lib/types.ts`) has stable identity and a
  stable `slug` (distinct from the display `title`, so renaming never breaks a
  URL). It references its titles by an **ordered** `mediaIds` array and never
  embeds a full `MediaItem`; when `isRanked`, that order is the ranking. It also
  carries a `description`, a sparse per-title `notes` map, `createdAt` /
  `updatedAt`, a `likeCount`, and a reserved `visibility` field for a future
  access model. Mock lists and their selectors live in `lib/data/lists.ts`:
  `getLists`, `getListBySlug`, `getListById`, `getListsByUser`, `getListMedia`,
  `getListItemNote`, `getListOwner`, `getPopularLists`,
  `getRecentlyUpdatedLists`, `getFeaturedLists`, `getListsFromCircle`, and
  `listSearchTermsFor`. All storage-shape knowledge stays in the data layer.
- **Mixed-media by design.** Movies, TV, and books share **one** `ListItemRow`
  renderer and **one** `ListCard`. There is no `MovieListCard` / `BookListCard`
  fork; the shared `MediaItem` union drives everything, and every list item and
  card links to the existing `/title/[slug]` and `/list/[slug]` routes.
- **Discovery index (`/lists`).** A concise header ("Collections made by people
  who love what you love.") over curated sections — Popular, From your circle,
  Recently updated, and Staff picks — each rendered with `ListCard`. Cards are
  editorial rather than dashboard-like: an overlapping fan of cover art
  (`ListPreviewCovers`, fully decorative), the title, creator, description, item
  count, like count, and mixed-media / ranked hints.
- **Lightweight local search.** The only Client Component on the index
  (`ListsBrowser`) filters lists by title, description, or creator against a
  server-built haystack. It is intentionally discovery-first — no tags, no
  advanced filtering, no search library, no URL state.
- **List detail (`/list/[slug]`).** `ListHeader` shows the single `h1`, the
  creator, description, item/updated metadata, and presentation-only Like /
  Share actions (`ListActions` — the like toggle is optimistic/in-memory and
  Share copies the URL to the clipboard; nothing is persisted). The ordered
  contents render as `ListItemRow`s with a rank (for ranked lists), artwork,
  title, year, media type, community rating, and an optional curator note. A
  restrained "More lists from this creator" (or "More collections") section
  closes the page. Unknown slugs call `notFound()` and render the site-wide 404.

### Title detail (`/title/[slug]`)

One route serves every `MediaItem` kind — no separate `/movie`, `/tv`, or
`/book` trees. The URL is keyed on the stable `MediaItem.slug` so display
titles can change without breaking links. Invalid slugs use Next.js
`notFound()` and render `app/not-found.tsx`.

- **Media-type-specific rendering.** `MediaHero` and `MediaDetails` narrow on
  the discriminated `MediaItem` union so each kind only shows the fields
  that logically belong to it: director / runtime / cast for movies;
  creators / seasons / episode count / run status for TV; author(s) / page
  count / publisher for books. The page structure is shared; only these
  small components specialize.
- **Dynamic metadata.** `generateMetadata` is per-title: page title,
  description, Open Graph title/description/url/image, and Twitter card
  are all derived from the item's own data. URLs are built from
  `lib/site-config.ts` (no hard-coded canonical domain).
- **Community rating.** `RatingBreakdown` renders the average, rating
  count, and a semantic 5-row histogram. Counts and percentages are
  visible text — bar width alone never carries the meaning. The
  underlying distribution is produced by `getRatingDistribution` in
  `lib/data`, which synthesises a deterministic bell-shaped histogram
  from the item's `averageRating` so no per-user rating rows are needed
  in the mock catalog.
- **Popular reviews.** Reviews are looked up through `getReviewsForMedia`
  and resolved to users via the shared mock user layer, then rendered
  with the existing `ReviewCard`. When a title has no reviews the
  section falls back to `EmptyState` rather than fabricating content.
- **Cross-media "More like this".** `getRelatedMedia` prefers curated
  relationships in `recommendationShelves` and falls back to a
  deterministic same-genre / rating-ordered walk across the full
  catalog. Related items intentionally may span films, series, and
  books, and always link back to `/title/[slug]` through the existing
  `MediaCard`.
- **Actions.** For a signed-in, onboarded viewer, **Log / Rate / Review** open
  one shared accessible dialog and persist through `logTitleAction` →
  `public.log_media(...)`. When the viewer has already logged the title, their
  latest **personal state** (verb, date, rating) is shown with owner-only
  **Edit** and **Delete** controls (`update_diary_entry` / `delete_diary_entry`).
  The primary action reads **Log** (or **Log again** once logged) — never a
  personalized "Watched"/"Read" for a signed-out visitor. Signed-out
  Log/Rate/Review are real links into the safe sign-in `returnTo` flow.
  **Add to list** remains honestly disabled (`aria-disabled`).

### Profile (`/profile/[username]`)

A person's Favalog profile is their entertainment identity in one editorial,
single-`h1` page. The route is keyed on the stable `User.username` (distinct
from the mutable `displayName`), so `/profile/jamie` is the primary demo
(Jamie DeMarco). Unknown usernames call `notFound()` and render the site-wide 404. The app-shell avatar links here for the mock current viewer.

- **Stored identity vs. derived statistics.** `User` stores only identity
  (`username`, `displayName`, `avatarUrl`, `bio`, optional `location`,
  `joinedAt`, follower/following counts). Every headline statistic — movies
  watched, shows watched, books read, reviews, lists, and average rating — is
  **derived** from the existing diary, reviews, and lists via
  `getUserProfileStats` in `lib/data/profile.ts`, never hardcoded, so the
  numbers can never drift from the underlying records.
- **Data layer.** Profile selectors live behind `@/lib/data`:
  `getUserByUsername`, `getCurrentUser`, `getUserFavorites`,
  `getUserCurrentlyEnjoying`, `getReviewsByUser`, `getActivityForUser`,
  `getUserProfileStats`, `getUserRecentlyWatched`, `getUserRecentlyRead`, and
  `getUserRecentActivity`. Favorites and "currently enjoying" are thin,
  ordered `Favorite` / `CurrentlyEnjoying` records that reference media by
  `mediaId` — no media, review, list, diary, or activity data is duplicated.
- **Sections.** A cinematic `ProfileHeader` (avatar, name, `@username`, bio,
  location, join date, follower/following counts, decorative cover collage,
  and a presentation-only **Edit profile** action for the current viewer),
  a restrained derived-statistics band (`ProfileStats`), a prominent
  cross-media **Favorites** shelf (`FavoriteMediaGrid`), **Currently
  enjoying**, **Recently watched** / **Recently read** rows drawn from the
  diary, **Recent reviews** (`ReviewCard`, `EmptyState` when none), **Lists**
  (`ListCard` with a "Browse all lists" link), and a lightweight **Recent
  activity** feed (`ActivityCard`). Sections are composed with focused
  `ProfileHeader`, `ProfileSection`, and `FavoriteMediaGrid` components rather
  than one enormous page.
- **Dynamic metadata.** `generateMetadata` derives the title
  (`Display Name (@username)`), description (the bio), and Open Graph / Twitter
  tags from the user, with the canonical URL built from `lib/site-config.ts`.
- **Editing is out of scope.** No authentication, editing, avatar uploads,
  following/unfollowing, or persistence — the profile is read-only against the
  mock data layer.

---

## Future architecture direction

- **Backend / data**: swap `lib/data` for a fetcher that returns the same
  types (server actions and/or a REST/GraphQL client). Domain types and UI
  components stay unchanged.
- **Authentication**: session/identity provider (e.g. Auth.js) wired into
  Server Components via `cookies()`; no client-side auth state.
- **Media metadata**: integrate real catalogs (e.g. TMDB, OpenLibrary) behind
  the `MediaItem` type so the UI keeps working through the transition.
- **Activity, diary & lists**: persist per-user activity, diary/log entries,
  follows, and lists in a database, keyed to the authenticated user; the feed
  and diary become real queries rather than static arrays. Diary write actions
  (log / rate / review a title) are intentionally out of scope until the write
  path and authentication exist.
- **Reviews & ratings**: server actions for create/update; optimistic UI in
  the few Client Components that need it.
- **Recommendations & stats**: derived views built on top of activity —
  intentionally out of scope until the write path exists.
- **Search**: full-text search over `MediaItem` served from the backend. The
  header's `SearchInput` is presentation-only for now.
- **Canonical domain**: the site URL is resolved in `lib/site-config.ts` from
  `NEXT_PUBLIC_SITE_URL`, then Vercel's `VERCEL_URL`, then
  `http://localhost:3000` in development, falling back to the current
  deployment at `https://favalog.vercel.app`. When a production domain
  (e.g. `favalog.com`) is chosen and owned, either set
  `NEXT_PUBLIC_SITE_URL` at deploy time or update the fallback in
  `lib/site-config.ts`.

---

## Notes

- Placeholder artwork is generated SVG under `public/media/`. When the app is
  wired to a real catalog, replace these with remote URLs and add the host to
  `images.remotePatterns` in `next.config.ts`.
- The app is dark-only for now. A light theme can be added later by swapping
  the CSS custom properties in `app/globals.css`.
