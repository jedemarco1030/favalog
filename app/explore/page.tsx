import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { HorizontalMediaRow } from "@/components/media/horizontal-media-row";
import { ExploreSearch } from "@/components/media/explore-search";
import {
  getCriticallyAcclaimed,
  getHiddenGems,
  getNewAndNoteworthy,
  getPopularBooks,
  getPopularMovies,
  getPopularTV,
  getTrendingMedia,
} from "@/lib/data";
import type { MediaItem } from "@/lib/types";
import { parseKindFilter } from "@/lib/search/query";
import { searchCatalog } from "@/lib/supabase/search";
import type { SearchOutcome } from "@/lib/supabase/search-view-model";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Search Favalog's catalog by title, creator, genre, mood, or theme, and browse editorial shelves across movies, TV, and books.",
};

function parseQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : "";
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = parseQuery(params.q).trim();
  const initialFilter = parseKindFilter(params.type);

  // Real, server-side catalog search runs only when there is an active query, so
  // no paid embedding request happens on a bare Explore visit. When Supabase is
  // unconfigured the service returns `unavailable` and the page keeps showing the
  // editorial shelves (no-environment public browsing is preserved).
  const outcome: SearchOutcome | null =
    rawQuery.length > 0
      ? await searchCatalog({ query: rawQuery, kind: initialFilter })
      : null;

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
      description: "Movies, shows, and books rising across Favalog this week.",
      items: getTrendingMedia(10),
      priorityFirst: true,
    },
    {
      key: "popular-movies",
      title: "Popular movies",
      description: "What people are watching on the big screen right now.",
      items: getPopularMovies(5),
    },
    {
      key: "popular-books",
      title: "Popular books",
      description: "Novels and nonfiction that keep coming back to the top.",
      items: getPopularBooks(5),
    },
    {
      key: "popular-tv",
      title: "Popular television",
      description: "Series with the strongest recent word of mouth.",
      items: getPopularTV(5),
    },
    {
      key: "critically-acclaimed",
      title: "Critically acclaimed",
      description: "Highly rated across films, series, and books.",
      items: getCriticallyAcclaimed(5),
    },
    {
      key: "new-and-noteworthy",
      title: "New & noteworthy",
      description: "Fresh releases worth a look.",
      items: getNewAndNoteworthy(5),
    },
    {
      key: "hidden-gems",
      title: "Hidden gems",
      description: "Quieter titles we think deserve a bigger audience.",
      items: getHiddenGems(),
    },
  ];

  const defaultSections = (
    <div key="default-sections" className="flex flex-col gap-16">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
        Editorial examples — curated demonstration shelves
      </p>
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
          Search the catalog by title, creator, genre, mood, or theme.
        </p>
      </header>
      <ExploreSearch
        initialQuery={rawQuery}
        initialFilter={initialFilter}
        outcome={outcome}
        defaultSections={defaultSections}
      />
    </Container>
  );
}
