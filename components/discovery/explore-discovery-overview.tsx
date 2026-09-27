import { getDiscoveryShelf } from "@/lib/discovery/service";
import { DISCOVERY_SHELVES } from "@/lib/discovery/shelves";
import type { DiscoveryShelfId } from "@/lib/discovery/types";
import type { MediaKind } from "@/lib/types";
import { hasProviderPoster } from "@/lib/media/artwork";
import { cardContext } from "./home-discovery";
import { DiscoveryShelf } from "./discovery-shelf";

const OVERVIEW: ReadonlyArray<{
  id: DiscoveryShelfId;
  kind: MediaKind;
  title: string;
  limit: number;
}> = [
  { id: "movie-trending", kind: "movie", title: "Films", limit: 5 },
  { id: "tv-trending", kind: "tv", title: "Television", limit: 5 },
  { id: "book-trending", kind: "book", title: "Books", limit: 5 },
  { id: "game-popular", kind: "game", title: "Games", limit: 3 },
];

/**
 * The empty-query "All" view on Explore: one equal-weight provider shelf per
 * media type, each linking to that type's full paged discovery browser. A
 * provider that is off or failing drops only its own shelf.
 */
export async function ExploreDiscoveryOverview({
  returnTo = "/explore",
}: {
  returnTo?: string;
}) {
  const [context, ...results] = await Promise.all([
    cardContext(returnTo),
    ...OVERVIEW.map(({ id }) => getDiscoveryShelf(id)),
  ]);

  const shelves = OVERVIEW.flatMap((shelf, i) => {
    const result = results[i];
    if (result.status !== "ok") return [];
    const candidates = result.page.candidates
      .filter(hasProviderPoster)
      .slice(0, shelf.limit);
    return candidates.length > 0 ? [{ ...shelf, candidates }] : [];
  });

  if (shelves.length === 0) return null;

  return (
    <div
      id="discover"
      className="flex scroll-mt-24 flex-col gap-12 border-t border-border/60 pt-10"
    >
      {shelves.map(({ id, kind, title, candidates }) => (
        <DiscoveryShelf
          key={id}
          id={id}
          title={title}
          description={DISCOVERY_SHELVES[id].description}
          candidates={candidates}
          href={`/explore?type=${kind}#discover`}
          linkLabel={`Browse all ${title.toLowerCase()}`}
          {...context}
        />
      ))}
    </div>
  );
}
