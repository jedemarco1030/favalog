import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { HorizontalMediaRow } from "@/components/media/horizontal-media-row";
import {
  ExploreDiscovery,
  type ExploreFilter,
} from "@/components/media/explore-discovery";
import {
  getAllMedia,
  getCriticallyAcclaimed,
  getHiddenGems,
  getNewAndNoteworthy,
  getPopularBooks,
  getPopularMovies,
  getPopularTV,
  getTrendingMedia,
  searchTermsFor,
} from "@/lib/data";
import type { MediaItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Find your next movie, show, or book. Search Favalog's catalog and browse editorial shelves across every media type.",
};

const VALID_FILTERS: ReadonlySet<ExploreFilter> = new Set([
  "all",
  "movie",
  "tv",
  "book",
]);

function parseFilter(raw: string | string[] | undefined): ExploreFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_FILTERS.has(value as ExploreFilter)) {
    return value as ExploreFilter;
  }
  return "all";
}

function parseQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : "";
}

/**
 * Build the lowercase search haystack for each `MediaItem` up front, on the
 * server. This is cheap for a mock catalog and keeps the client from
 * needing to understand which discriminant carries which credit.
 */
function buildHaystack(items: MediaItem[]): Record<string, string> {
  const haystack: Record<string, string> = {};
  for (const item of items) {
    haystack[item.id] = searchTermsFor(item).join(" ").toLowerCase();
  }
  return haystack;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialQuery = parseQuery(params.q);
  const initialFilter = parseFilter(params.type);

  const allMedia = getAllMedia();
  const haystack = buildHaystack(allMedia);

  const trending = getTrendingMedia(10);
  const popularMovies = getPopularMovies(5);
  const popularBooks = getPopularBooks(5);
  const popularTV = getPopularTV(5);
  const criticallyAcclaimed = getCriticallyAcclaimed(5);
  const newAndNoteworthy = getNewAndNoteworthy(5);
  const hiddenGems = getHiddenGems();

  const shelves: Array<{
    key: string;
    title: string;
    description: string;
    items: MediaItem[];
    priorityFirst?: boolean;
  }> = [
    {
      key: "trending",
      title: "Trending now",
      description:
        "Movies, shows, and books rising across Favalog this week.",
      items: trending,
      priorityFirst: true,
    },
    {
      key: "popular-movies",
      title: "Popular movies",
      description: "What people are watching on the big screen right now.",
      items: popularMovies,
    },
    {
      key: "popular-books",
      title: "Popular books",
      description: "Novels and nonfiction that keep coming back to the top.",
      items: popularBooks,
    },
    {
      key: "popular-tv",
      title: "Popular television",
      description: "Series with the strongest recent word of mouth.",
      items: popularTV,
    },
    {
      key: "critically-acclaimed",
      title: "Critically acclaimed",
      description: "Highly rated across films, series, and books.",
      items: criticallyAcclaimed,
    },
    {
      key: "new-and-noteworthy",
      title: "New & noteworthy",
      description: "Fresh releases worth a look.",
      items: newAndNoteworthy,
    },
    {
      key: "hidden-gems",
      title: "Hidden gems",
      description: "Quieter titles we think deserve a bigger audience.",
      items: hiddenGems,
    },
  ];

  const defaultSections = (
    <div key="default-sections" className="flex flex-col gap-16">
      {shelves.map((shelf) => (
        <HorizontalMediaRow
          key={shelf.key}
          title={shelf.title}
          description={shelf.description}
          items={shelf.items}
          priorityFirst={shelf.priorityFirst}
        />
      ))}
    </div>
  );

  return (
    <Container className="py-10 md:py-14">
      <header className="mb-8 max-w-2xl md:mb-10">
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          Explore
        </h1>
        <p className="mt-3 text-base text-foreground/70">
          Find your next movie, show, or book.
        </p>
      </header>
      <ExploreDiscovery
        items={allMedia}
        haystack={haystack}
        initialQuery={initialQuery}
        initialFilter={initialFilter}
        defaultSections={defaultSections}
      />
    </Container>
  );
}
