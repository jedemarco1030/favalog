# Lorely

> **Everything you watch and read. One place to remember it.**

Lorely is a social entertainment platform that combines the ideas behind
Letterboxd and Goodreads into a single home for films, television, and books.
Track what you watch and read, rate it, review it, build lists, follow other
people, and remember it later.

This repository is the **frontend MVP**. It is deliberately built against a
typed mock-data layer — there is no backend, no authentication, no external
media API, and no AI yet. The architecture is designed so those pieces can
drop in later without touching the UI code.

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
  page.tsx               Home page (hero + media rows + activity feed)
  globals.css            Tailwind entry + design tokens

components/
  brand/                 Wordmark and brand-only assets
  layout/                Site header and footer
  ui/                    Design-system primitives (Container, Badge, StarRating)
  media/                 MediaCard and related presentational components
  activity/              ActivityCard used by the feed

lib/
  types.ts               Strongly typed domain models
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

The current implementation covers the **foundation** only:

- Design system: dark-first tokens, editorial typography, accent color
- Root layout with SEO metadata, viewport, and Open Graph tags
- Reusable primitives: `Container`, `Badge`, `StarRating`, `MediaCard`,
  `ActivityCard`, `SiteHeader`, `SiteFooter`, `Logo`
- Typed domain models: `User`, `MediaItem`, `Movie`, `TVShow`, `Book`,
  `Review`, `Rating`, `List`, `ActivityItem`
- Mock data layer at `lib/data`
- Home page with hero, film / series / book rows, and a feed preview

Detail routes (`/films`, `/series`, `/books`, `/activity`, `/join`) are linked
in the navigation but not yet implemented — they will be built on top of this
foundation.

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
- **Search**: full-text search over `MediaItem` served from the backend.

---

## Notes

- Placeholder artwork is generated SVG under `public/media/`. When the app is
  wired to a real catalog, replace these with remote URLs and add the host to
  `images.remotePatterns` in `next.config.ts`.
- The app is dark-only for now. A light theme can be added later by swapping
  the CSS custom properties in `app/globals.css`.
