import type { ExternalRef } from "@/lib/catalog/types";
import { relatedHeading } from "@/lib/discovery/related";
import { getRelatedTitles } from "@/lib/discovery/related-service";
import { DiscoveryShelf } from "./discovery-shelf";
import { cardContext } from "./home-discovery";

const SOURCE_NOTE = {
  collection: "From TMDB, in release order.",
  developer: "From RAWG, most added first.",
  author: "From Open Library.",
} as const;

/**
 * Related provider titles for a saved title. Each card opens and saves through
 * the same trusted materializer as discovery, so related titles are viewable
 * and saveable before they exist in Favalog. Renders nothing when the title has
 * no provider relationship or the provider is off or failing.
 */
export async function RelatedTitles({
  externalRef,
  returnTo,
}: {
  externalRef: ExternalRef;
  returnTo: string;
}) {
  const group = await getRelatedTitles(externalRef);
  if (!group) return null;

  return (
    <DiscoveryShelf
      id={`related-${group.relation}`}
      title={relatedHeading(group)}
      description={SOURCE_NOTE[group.relation]}
      candidates={group.candidates}
      showDate={group.relation !== "author"}
      {...await cardContext(returnTo)}
    />
  );
}
