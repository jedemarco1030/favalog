import { materializeExternalTitleAction } from "@/app/explore/actions";
import { saveDiscoveredTitleAction } from "@/app/discovery/actions";
import { mergeByReleaseDate } from "@/lib/discovery/merge";
import { getDiscoveryShelf } from "@/lib/discovery/service";
import { DISCOVERY_SHELVES } from "@/lib/discovery/shelves";
import type { DiscoveryShelfId } from "@/lib/discovery/types";
import type { ExternalProvider } from "@/lib/catalog/types";
import { getSaveListOptions } from "./save-list-options";
import { DiscoveryShelf } from "./discovery-shelf";

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

const PROVIDER_NAMES: Record<ExternalProvider, string> = {
  tmdb: "TMDB",
  rawg: "RAWG",
  openlibrary: "Open Library",
};

const UPCOMING: readonly DiscoveryShelfId[] = [
  "movie-upcoming",
  "game-upcoming",
];
const UPCOMING_LIMIT = 5;

/**
 * Live provider shelves for Home. Every shelf states whose ranking it shows,
 * reads through the shared discovery cache, and disappears on its own when its
 * provider is disabled or failing — the rest of Home is unaffected.
 */
export async function HomeDiscovery({ returnTo = "/" }: { returnTo?: string }) {
  const [lists, upcoming, ...shelves] = await Promise.all([
    getSaveListOptions(),
    Promise.all(UPCOMING.map((id) => getDiscoveryShelf(id))),
    ...HOME_SHELVES.map(({ id }) => getDiscoveryShelf(id)),
  ]);

  const context = {
    lists,
    returnTo,
    openAction: materializeExternalTitleAction,
    saveAction: saveDiscoveredTitleAction,
  };

  const upcomingPages = upcoming.flatMap((r) =>
    r.status === "ok" ? [r.page] : [],
  );
  const comingSoon = mergeByReleaseDate(
    upcomingPages.map((p) => p.candidates),
    "asc",
    UPCOMING_LIMIT,
  );
  const upcomingSources = upcomingPages
    .map((p) => PROVIDER_NAMES[p.provider])
    .join(" and ");

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
            candidates={result.page.candidates.slice(0, limit)}
            href={`/explore?type=${def.kind}&discover=${def.sort}`}
            linkLabel="Browse more"
            {...context}
          />
        );
      })}
      {comingSoon.length > 0 && (
        <DiscoveryShelf
          id="coming-soon"
          title="Coming soon"
          description={`Confirmed release dates from ${upcomingSources}, soonest first.`}
          candidates={comingSoon}
          showDate
          showKind
          {...context}
        />
      )}
    </>
  );
}
