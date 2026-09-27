import type { ExternalProvider } from "@/lib/catalog/types";
import type { MediaKind } from "@/lib/types";
import type { DiscoveryShelfId, DiscoverySort, RankingSignal } from "./types";
import { RECENT_WINDOW_DAYS } from "./windows";

/**
 * The declared discovery shelves. Every shelf is ONE provider, ONE media kind,
 * and ONE provider-side ordering, so pagination walks the provider's own
 * globally sorted result set — never a locally re-sorted page.
 *
 * Freshness windows are how long a fetched page is served from the shared cache
 * before it is refetched in the background. Request budget per shelf: at most
 * `maxPages` provider requests per freshness window per UTC day.
 */

/** Minimum TMDB vote count before a title can appear on a "Highest rated" shelf. */
export const TMDB_TOP_RATED_MIN_VOTES = { movie: 500, tv: 300 } as const;

const HOUR = 60 * 60;

export interface ShelfDefinition {
  id: DiscoveryShelfId;
  kind: MediaKind;
  sort: DiscoverySort;
  provider: ExternalProvider;
  ranking: RankingSignal;
  /** Short sort/shelf name, e.g. "Coming soon". */
  label: string;
  /** Plain statement of what the order means. Shown to users. */
  description: string;
  freshnessSeconds: number;
  maxPages: number;
  pageSize: number;
}

export const DISCOVERY_SHELVES: Readonly<
  Record<DiscoveryShelfId, ShelfDefinition>
> = {
  "movie-trending": {
    id: "movie-trending",
    kind: "movie",
    sort: "trending",
    provider: "tmdb",
    ranking: "tmdb-trending-week",
    label: "Trending",
    description: "Films trending on TMDB this week.",
    freshnessSeconds: 6 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "movie-popular": {
    id: "movie-popular",
    kind: "movie",
    sort: "popular",
    provider: "tmdb",
    ranking: "tmdb-popularity",
    label: "Popular",
    description: "Films ranked by TMDB popularity.",
    freshnessSeconds: 6 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "movie-recent": {
    id: "movie-recent",
    kind: "movie",
    sort: "recent",
    provider: "tmdb",
    ranking: "tmdb-popularity",
    label: "Recent releases",
    description: `Films first released in the last ${RECENT_WINDOW_DAYS} days, by TMDB popularity.`,
    freshnessSeconds: 12 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "movie-upcoming": {
    id: "movie-upcoming",
    kind: "movie",
    sort: "upcoming",
    provider: "tmdb",
    ranking: "tmdb-popularity",
    label: "Coming soon",
    description:
      "Films with a stated release date in the next year, by TMDB popularity.",
    freshnessSeconds: 12 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "movie-top-rated": {
    id: "movie-top-rated",
    kind: "movie",
    sort: "top-rated",
    provider: "tmdb",
    ranking: "tmdb-vote-average",
    label: "Highest rated",
    description: `Films by TMDB user rating, counting only titles with at least ${TMDB_TOP_RATED_MIN_VOTES.movie} votes.`,
    freshnessSeconds: 24 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "tv-trending": {
    id: "tv-trending",
    kind: "tv",
    sort: "trending",
    provider: "tmdb",
    ranking: "tmdb-trending-week",
    label: "Trending",
    description: "Series trending on TMDB this week.",
    freshnessSeconds: 6 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "tv-popular": {
    id: "tv-popular",
    kind: "tv",
    sort: "popular",
    provider: "tmdb",
    ranking: "tmdb-popularity",
    label: "Popular",
    description: "Series ranked by TMDB popularity.",
    freshnessSeconds: 6 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "tv-recent": {
    id: "tv-recent",
    kind: "tv",
    sort: "recent",
    provider: "tmdb",
    ranking: "tmdb-popularity",
    label: "New series",
    description: `Series that first aired in the last ${RECENT_WINDOW_DAYS} days, by TMDB popularity.`,
    freshnessSeconds: 12 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "tv-top-rated": {
    id: "tv-top-rated",
    kind: "tv",
    sort: "top-rated",
    provider: "tmdb",
    ranking: "tmdb-vote-average",
    label: "Highest rated",
    description: `Series by TMDB user rating, counting only titles with at least ${TMDB_TOP_RATED_MIN_VOTES.tv} votes.`,
    freshnessSeconds: 24 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "game-popular": {
    id: "game-popular",
    kind: "game",
    sort: "popular",
    provider: "rawg",
    ranking: "rawg-added",
    label: "Popular",
    description: "Games most often added to collections by RAWG users.",
    freshnessSeconds: 6 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "game-recent": {
    id: "game-recent",
    kind: "game",
    sort: "recent",
    provider: "rawg",
    ranking: "rawg-added",
    label: "Recent releases",
    description: `Games released in the last ${RECENT_WINDOW_DAYS} days, by how often RAWG users added them.`,
    freshnessSeconds: 12 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "game-upcoming": {
    id: "game-upcoming",
    kind: "game",
    sort: "upcoming",
    provider: "rawg",
    ranking: "rawg-added",
    label: "Coming soon",
    description:
      "Games with a confirmed release date in the next year, by how often RAWG users added them. Games without a confirmed date are left out.",
    freshnessSeconds: 12 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "game-top-rated": {
    id: "game-top-rated",
    kind: "game",
    sort: "top-rated",
    provider: "rawg",
    ranking: "rawg-metacritic",
    label: "Highest rated",
    description:
      "Games by Metascore. Metacritic publishes a Metascore only after at least four critic reviews; games without one are left out.",
    freshnessSeconds: 24 * HOUR,
    maxPages: 5,
    pageSize: 20,
  },
  "book-trending": {
    id: "book-trending",
    kind: "book",
    sort: "trending",
    provider: "openlibrary",
    ranking: "openlibrary-trending-weekly",
    label: "Trending",
    description: "Books trending on Open Library this week.",
    freshnessSeconds: 6 * HOUR,
    maxPages: 2,
    pageSize: 20,
  },
};

/** Sorts each media type supports on Explore, first one is the default. */
export const SORTS_BY_KIND: Readonly<
  Record<MediaKind, readonly DiscoverySort[]>
> = {
  movie: ["popular", "trending", "recent", "upcoming", "top-rated"],
  tv: ["popular", "trending", "recent", "top-rated"],
  game: ["popular", "recent", "upcoming", "top-rated"],
  book: ["trending"],
};

export function shelfFor(
  kind: MediaKind,
  sort: DiscoverySort,
): ShelfDefinition | null {
  const id = `${kind}-${sort}` as DiscoveryShelfId;
  return Object.hasOwn(DISCOVERY_SHELVES, id) ? DISCOVERY_SHELVES[id] : null;
}

/** Validate a URL `sort` for a kind, falling back to that kind's default. */
export function parseDiscoverySort(
  kind: MediaKind,
  raw: string | undefined,
): DiscoverySort {
  const sorts = SORTS_BY_KIND[kind];
  return sorts.find((sort) => sort === raw) ?? sorts[0];
}

/** Validate a URL `page` against a shelf's page cap. */
export function parseDiscoveryPage(
  raw: string | undefined,
  def: ShelfDefinition,
): number {
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, def.maxPages);
}
