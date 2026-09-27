import type { ReactNode } from "react";
import { materializeExternalTitleAction } from "@/app/explore/actions";
import { saveDiscoveredTitleAction } from "@/app/discovery/actions";
import { FeaturedBanner } from "@/components/home/featured-banner";
import {
  mergeByReleaseDate,
  pickDiscoveryFeatured,
} from "@/lib/discovery/merge";
import { getDiscoveryShelf } from "@/lib/discovery/service";
import { DISCOVERY_SHELVES } from "@/lib/discovery/shelves";
import type {
  DiscoveryCandidate,
  DiscoveryPage,
  DiscoveryShelfId,
} from "@/lib/discovery/types";
import type { ExternalProvider } from "@/lib/catalog/types";
import { hasProviderPoster } from "@/lib/media/artwork";
import { DiscoveryCardActions } from "./discovery-card-actions";
import type { DiscoveryCardContext } from "./discovery-card";
import { getSaveListOptions } from "./save-list-options";
import { DiscoveryShelf } from "./discovery-shelf";

const PROVIDER_NAMES: Record<ExternalProvider, string> = {
  tmdb: "TMDB",
  rawg: "RAWG",
  openlibrary: "Open Library",
};

const HOME_SHELVES: ReadonlyArray<{
  id: DiscoveryShelfId;
  title: string;
  limit: number;
}> = [
  { id: "movie-trending", title: "Trending films", limit: 5 },
  { id: "tv-trending", title: "Trending series", limit: 5 },
  { id: "game-popular", title: "Popular games", limit: 3 },
  { id: "book-trending", title: "Trending books", limit: 5 },
];

const RECENT: readonly DiscoveryShelfId[] = [
  "movie-recent",
  "tv-recent",
  "game-recent",
];
const UPCOMING: readonly DiscoveryShelfId[] = [
  "movie-upcoming",
  "game-upcoming",
];
const DATED_LIMIT = 5;

/** Lists the daily featured pick is drawn from, each in its provider's order. */
const FEATURED_FROM: readonly DiscoveryShelfId[] = [
  "movie-trending",
  "tv-trending",
  "game-popular",
];

const FEATURED_EYEBROW: Partial<Record<DiscoveryShelfId, string>> = {
  "movie-trending": "Trending on TMDB",
  "tv-trending": "Trending on TMDB",
  "game-popular": "Popular on RAWG",
};

function okPages(
  results: Awaited<ReturnType<typeof getDiscoveryShelf>>[],
): DiscoveryPage[] {
  return results.flatMap((r) => (r.status === "ok" ? [r.page] : []));
}

/** Home promotes titles with real artwork; provider order is otherwise kept. */
function withArtwork(candidates: readonly DiscoveryCandidate[]) {
  return candidates.filter(hasProviderPoster);
}

function sourcesOf(pages: readonly DiscoveryPage[]): string {
  return [...new Set(pages.map((p) => PROVIDER_NAMES[p.provider]))].join(
    " and ",
  );
}

async function cardContext(returnTo: string): Promise<DiscoveryCardContext> {
  return {
    lists: await getSaveListOptions(),
    returnTo,
    openAction: materializeExternalTitleAction,
    saveAction: saveDiscoveredTitleAction,
  };
}

/**
 * The provider-led Home hero: one stable daily pick from the top of TMDB and
 * RAWG's own lists, restricted to titles with a real wide backdrop. Renders
 * `fallback` when discovery has nothing suitable (a provider off or failing).
 */
export async function HomeFeatured({
  dayIndex,
  returnTo = "/",
  fallback,
}: {
  dayIndex: number;
  returnTo?: string;
  fallback: ReactNode;
}) {
  const results = await Promise.all(
    FEATURED_FROM.map((id) => getDiscoveryShelf(id)),
  );
  const pages = okPages(results);
  const pick = pickDiscoveryFeatured(
    pages.map((p) => p.candidates),
    dayIndex,
  );
  if (!pick) return <>{fallback}</>;
  const page = pages.find((p) => p.candidates.includes(pick));
  const context = await cardContext(returnTo);

  return (
    <FeaturedBanner
      item={{
        title: pick.title,
        kind: pick.kind,
        year: pick.year,
        synopsis: pick.overview,
        posterUrl: pick.posterUrl,
        backdropUrl: pick.backdropUrl,
      }}
      eyebrow={(page && FEATURED_EYEBROW[page.shelfId]) ?? "Featured today"}
      cta={
        <DiscoveryCardActions
          identity={pick.ref}
          title={pick.title}
          {...context}
        />
      }
    />
  );
}

/**
 * Live provider shelves for Home. Every shelf states whose ranking it shows,
 * reads through the shared discovery cache, and disappears on its own when its
 * provider is disabled or failing, leaving the rest of Home unaffected. Dated
 * shelves use real stated release dates, never a bare year.
 */
export async function HomeDiscovery({ returnTo = "/" }: { returnTo?: string }) {
  const [context, recent, upcoming, ...shelves] = await Promise.all([
    cardContext(returnTo),
    Promise.all(RECENT.map((id) => getDiscoveryShelf(id))),
    Promise.all(UPCOMING.map((id) => getDiscoveryShelf(id))),
    ...HOME_SHELVES.map(({ id }) => getDiscoveryShelf(id)),
  ]);

  const recentPages = okPages(recent);
  const newReleases = mergeByReleaseDate(
    recentPages.map((p) => withArtwork(p.candidates)),
    "desc",
    DATED_LIMIT,
  );
  const upcomingPages = okPages(upcoming);
  const comingSoon = mergeByReleaseDate(
    upcomingPages.map((p) => withArtwork(p.candidates)),
    "asc",
    DATED_LIMIT,
  );

  return (
    <>
      {HOME_SHELVES.map(({ id, title, limit }, index) => {
        const result = shelves[index];
        if (result.status !== "ok") return null;
        const def = DISCOVERY_SHELVES[id];
        return (
          <DiscoveryShelf
            key={id}
            id={id}
            title={title}
            description={def.description}
            candidates={withArtwork(result.page.candidates).slice(0, limit)}
            href={`/explore?type=${def.kind}&discover=${def.sort}`}
            linkLabel="Browse more"
            {...context}
          />
        );
      })}
      <DiscoveryShelf
        id="new-releases"
        title="New releases"
        description={`Stated release dates from ${sourcesOf(recentPages)}, newest first.`}
        candidates={newReleases}
        showDate
        showKind
        {...context}
      />
      <DiscoveryShelf
        id="coming-soon"
        title="Coming soon"
        description={`Confirmed release dates from ${sourcesOf(upcomingPages)}, soonest first.`}
        candidates={comingSoon}
        showDate
        showKind
        {...context}
      />
    </>
  );
}
