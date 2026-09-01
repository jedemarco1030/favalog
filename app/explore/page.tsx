import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { HorizontalMediaRow } from "@/components/media/horizontal-media-row";
import { ExploreSearch } from "@/components/media/explore-search";
import { ExternalResultsSection } from "@/components/media/external-results-section";
import { CatalogBrowse } from "@/components/media/catalog-browse";
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
import type { SearchKindFilter } from "@/lib/search/config";
import { searchCatalog } from "@/lib/supabase/search";
import type { SearchOutcome } from "@/lib/supabase/search-view-model";
import { browseCatalog } from "@/lib/supabase/browse";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { availableExternalProviders } from "@/lib/catalog/feature-flag";
import { isAuthAvailable } from "@/lib/auth/capability";
import { getCurrentUser } from "@/lib/auth/data";

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
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    sort?: string | string[];
    page?: string | string[];
    genre?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawQuery = parseQuery(params.q).trim();
  const initialFilter = parseKindFilter(params.type);
  const supabaseConfigured = isSupabaseConfigured();

  // Real, server-backed browse runs ONLY when there is no active query AND
  // Supabase is configured. It never falls back to mock catalog data: a read
  // failure reports an error state rather than presenting example data as live
  // production activity. When Supabase is unconfigured, `browseOutcome` stays
  // null and the labelled editorial example shelves are shown instead.
  const browseOutcome =
    rawQuery.length === 0 && supabaseConfigured
      ? await browseCatalog({
          kind: params.type,
          sort: params.sort,
          page: params.page,
          genre: params.genre,
        })
      : null;

  // Real, server-side catalog search runs only when there is an active query, so
  // no paid embedding request happens on a bare Explore visit. When Supabase is
  // unconfigured the service returns `unavailable` and the page keeps showing the
  // editorial shelves (no-environment public browsing is preserved).
  const outcome: SearchOutcome | null =
    rawQuery.length > 0
      ? await searchCatalog({ query: rawQuery, kind: initialFilter })
      : null;

  // Federated external discovery (Catalog Platform v1B) is strictly opt-in: it
  // runs ONLY for an active query and ONLY when the server-side feature flag is
  // on AND a provider is configured. When it is off/unconfigured, `providers` is
  // empty and the page renders exactly the local-only experience as before.
  const providers = rawQuery.length > 0 ? availableExternalProviders() : [];
  const localSlugs =
    outcome && outcome.status === "ok"
      ? outcome.items.map((item) => item.slug)
      : [];
  const viewer = isAuthAvailable() ? await getCurrentUser() : null;
  const isAuthenticated = viewer !== null;
  const exploreReturnTo = buildExploreReturnTo(rawQuery, initialFilter);
  const signInHref = `/auth/sign-in?returnTo=${encodeURIComponent(
    exploreReturnTo,
  )}`;

  const externalSections =
    providers.length > 0 ? (
      <ExternalSections
        providers={providers}
        query={rawQuery}
        filter={initialFilter}
        localSlugs={localSlugs}
        isAuthenticated={isAuthenticated}
        signInHref={signInHref}
        returnTo={exploreReturnTo}
      />
    ) : null;

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

  const editorialExampleSections = (
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

  // When Supabase is configured, the no-query view is the REAL catalog browser;
  // otherwise it is the clearly-labelled example shelves (no-env development).
  const defaultSections = browseOutcome ? (
    <CatalogBrowse outcome={browseOutcome} />
  ) : (
    editorialExampleSections
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
        externalSections={externalSections}
      />
    </Container>
  );
}

/** Build a safe, shareable Explore return path preserving the query + filter. */
function buildExploreReturnTo(query: string, filter: SearchKindFilter): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("type", filter);
  const search = params.toString();
  return search ? `/explore?${search}` : "/explore";
}

/**
 * The streamed federated sections for an active query. TMDB serves movies + TV;
 * Open Library serves books. Each section is INDEPENDENTLY Suspense-wrapped so a
 * slow provider streams in on its own and never blocks the local results or the
 * other provider. The active filter decides which sections apply.
 */
function ExternalSections({
  providers,
  query,
  filter,
  localSlugs,
  isAuthenticated,
  signInHref,
  returnTo,
}: {
  providers: readonly ("tmdb" | "openlibrary")[];
  query: string;
  filter: SearchKindFilter;
  localSlugs: string[];
  isAuthenticated: boolean;
  signInHref: string;
  returnTo: string;
}): ReactNode {
  const hasTmdb = providers.includes("tmdb");
  const hasOpenLibrary = providers.includes("openlibrary");
  const showMoviesTv = hasTmdb && filter !== "book";
  const showBooks = hasOpenLibrary && (filter === "all" || filter === "book");

  const tmdbHeading =
    filter === "movie"
      ? "More movies"
      : filter === "tv"
        ? "More TV"
        : "More movies & TV";

  return (
    <div className="flex flex-col gap-16">
      {showMoviesTv && (
        <Suspense fallback={<SectionSkeleton heading={tmdbHeading} />}>
          <ExternalResultsSection
            provider="tmdb"
            heading={tmdbHeading}
            query={query}
            kind={filter === "movie" || filter === "tv" ? filter : "all"}
            localSlugs={localSlugs}
            isAuthenticated={isAuthenticated}
            signInHref={signInHref}
            returnTo={returnTo}
          />
        </Suspense>
      )}
      {showBooks && (
        <Suspense fallback={<SectionSkeleton heading="More books" />}>
          <ExternalResultsSection
            provider="openlibrary"
            heading="More books"
            query={query}
            kind="book"
            localSlugs={localSlugs}
            isAuthenticated={isAuthenticated}
            signInHref={signInHref}
            returnTo={returnTo}
          />
        </Suspense>
      )}
    </div>
  );
}

/** A lightweight streaming placeholder for a federated section. */
function SectionSkeleton({ heading }: { heading: string }) {
  return (
    <section
      aria-label={heading}
      aria-busy="true"
      className="flex flex-col gap-4"
    >
      <h2 className="font-display text-xl tracking-tight text-foreground">
        {heading}
      </h2>
      <p className="text-sm text-foreground/50">Searching…</p>
    </section>
  );
}
