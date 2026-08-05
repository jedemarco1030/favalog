import type { MediaItem } from "@/lib/types";
import { MediaCard } from "@/components/media/media-card";
import { cn } from "@/lib/cn";

interface FavoriteMediaGridProps {
  items: MediaItem[];
  className?: string;
}

/**
 * A responsive, cross-media poster grid for a profile's Favorites shelf.
 *
 * Built once against the `MediaItem` union — each `MediaCard` already labels
 * its media kind and links to `/title/[slug]` from the stable slug — so a
 * person's movies, TV, and books read as one deliberate row of taste rather
 * than three parallel implementations. Rendering the empty case is left to the
 * caller (via `EmptyState`) so this component stays purely presentational.
 */
export function FavoriteMediaGrid({
  items,
  className,
}: FavoriteMediaGridProps) {
  return (
    <ul
      role="list"
      className={cn(
        "grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id}>
          <MediaCard item={item} />
        </li>
      ))}
    </ul>
  );
}
