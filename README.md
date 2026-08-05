# Favalog

> **Everything you watch and read. One place to remember it.**

Favalog is a social entertainment platform where people track, rate, review,
organize, and discover the movies, TV, and books they love. Long-term, a
person's Favalog becomes a living record of their taste — the things they
watch, read, and love, and eventually the games, music, and other interests
that make up their taste.

The current MVP scope is **movies, TV, and books**. This repository is built
against a typed mock-data layer — there is no backend, no authentication, no
external media API, and no AI yet. The architecture is designed so those
pieces can drop in later without rewriting the UI.

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
  invalid-list-slug 404, and the profile flow — app-shell avatar → profile,
  derived statistics, favorite title, one of the user's lists, and the
  unknown-username 404) against `next build` + `next start`, using semantic
  locators.
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
- **Actions.** Log / Rate / Review / Add to list are presentation-only
  buttons (`aria-disabled`) that communicate the shape of the future
  product. No persistence, no fake success states.

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
