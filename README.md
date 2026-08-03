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

| Concern            | Choice                                        |
| ------------------ | --------------------------------------------- |
| Framework          | Next.js 16 (App Router, React Server Components) |
| Language           | TypeScript (strict)                           |
| UI                 | React 19                                      |
| Styling            | Tailwind CSS v4 with CSS design tokens        |
| Icons              | `lucide-react`                                |
| Fonts              | Inter (sans), Fraunces (editorial serif), JetBrains Mono |
| Linting            | ESLint (flat config, `eslint-config-next`)    |

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
  lists/page.tsx         Lists placeholder
  title/[slug]/page.tsx  Unified movie / TV / book detail page, keyed by `MediaItem.slug`
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
  reviews/               ReviewCard
  user/                  UserAvatar, ProfileStats
  skeletons/             Media, activity/feed, and profile skeletons

lib/
  types.ts               Strongly typed domain models
  site-config.ts         Centralized brand name, tagline, and site URL
  cn.ts                  Class name joiner utility
  data/                  Mock data layer (users, media, activity, diary, index)

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
npm install
npm run dev       # Start the dev server on http://localhost:3000
npm run build     # Production build
npm run start     # Serve the production build
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript check
```

To regenerate the placeholder artwork after editing the mock catalog:

```bash
node scripts/generate-placeholders.mjs
```

---

## MVP scope (current)

The current implementation covers the **application shell, shared UI layer,
and lightweight placeholders** for every primary destination:

- Design system: dark-first tokens, editorial typography, accent color
- Root layout with deployment-aware SEO metadata and Open Graph tags,
  centralized in `lib/site-config.ts`
- Responsive top navigation: wordmark, primary nav, search field,
  notifications, avatar menu, and a dedicated mobile sheet
- Reusable primitives: `Container`, `Badge`, `StarRating`, `RatingDisplay`,
  `SearchInput`, `SectionHeader`, `EmptyState`, `Skeleton`
- Media components: `MediaCard`, `MediaPoster`, `MediaTypeBadge`,
  `HorizontalMediaRow`, `ExploreDiscovery`
- Social components: `ActivityCard`, `ReviewCard`, `UserAvatar`,
  `ProfileStats`
- Loading states: `MediaCardSkeleton`, `MediaRowSkeleton`,
  `ActivityCardSkeleton`, `FeedSkeleton`, `ProfileSkeleton`
- Typed domain models: `User`, `MediaItem`, `Movie`, `TVShow`, `Book`,
  `Review`, `Rating`, `List`, `ActivityItem`, `DiaryEntry` (every
  `MediaItem` has a stable `slug`, distinct from its display title)
- Mock data layer at `lib/data`
- Home page composed of a hero (with a mixed movie / TV / book collage),
  a unified **Trending this week** row, a **From your circle** social feed,
  a **Popular reviews** section, a **Because you liked …** cross-media
  recommendation preview, and a closing **Build your Favalog** CTA

### Primary navigation

| Route              | Status                                                        |
| ------------------ | -------------------------------------------------------------- |
| `/`                | Implemented (home)                                              |
| `/explore`         | Implemented — local search, All / Movies / TV / Books filter, editorial shelves |
| `/diary`           | Implemented — unified newest-first diary of movies, TV, and books, grouped by month, with All / Movies / TV / Books local filtering and a derived activity summary |
| `/lists`           | Placeholder — building and sharing lists is next                |
| `/title/[slug]`    | Implemented — unified detail page for movies, TV, and books with adaptive credits, community rating breakdown, popular reviews, and cross-media "More like this" |

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
