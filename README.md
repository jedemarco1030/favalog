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
  diary/page.tsx         Diary placeholder
  lists/page.tsx         Lists placeholder
  title/[slug]/page.tsx  Title detail placeholder, keyed by `MediaItem.slug`

components/
  brand/                 Wordmark and brand-only assets
  layout/                Site header, footer, primary nav, mobile nav
  ui/                    Design-system primitives (Container, Badge,
                         StarRating, RatingDisplay, SearchInput,
                         SectionHeader, EmptyState, Skeleton)
  media/                 MediaCard, MediaPoster, MediaTypeBadge,
                         HorizontalMediaRow
  activity/              ActivityCard used by the feed
  reviews/               ReviewCard
  user/                  UserAvatar, ProfileStats
  skeletons/             Media, activity/feed, and profile skeletons

lib/
  types.ts               Strongly typed domain models
  site-config.ts         Centralized brand name, tagline, and site URL
  cn.ts                  Class name joiner utility
  data/                  Mock data layer (users, media, activity, index)

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
  `Review`, `Rating`, `List`, `ActivityItem` (every `MediaItem` has a
  stable `slug`, distinct from its display title)
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
| `/diary`           | Placeholder — personal activity log is next                     |
| `/lists`           | Placeholder — building and sharing lists is next                |
| `/title/[slug]`    | Placeholder — shows title, artwork, and synopsis; full detail page (cast, reviews, ratings breakdown) is next |

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

---

## Future architecture direction

- **Backend / data**: swap `lib/data` for a fetcher that returns the same
  types (server actions and/or a REST/GraphQL client). Domain types and UI
  components stay unchanged.
- **Authentication**: session/identity provider (e.g. Auth.js) wired into
  Server Components via `cookies()`; no client-side auth state.
- **Media metadata**: integrate real catalogs (e.g. TMDB, OpenLibrary) behind
  the `MediaItem` type so the UI keeps working through the transition.
- **Activity & lists**: persist per-user activity, follows, and lists in a
  database; feed becomes a real query rather than a static array.
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
