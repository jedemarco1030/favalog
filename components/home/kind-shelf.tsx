import type { MediaItem, MediaKind } from "@/lib/types";
import { MediaCard } from "@/components/media/media-card";
import { SectionHeader } from "@/components/ui/section-header";

const SHELF_TITLE: Record<MediaKind, string> = {
  movie: "Explore films",
  tv: "Explore series",
  book: "Explore books",
  game: "Explore games",
};

interface KindShelfProps {
  kind: MediaKind;
  items: MediaItem[];
}

/**
 * One media type from Favalog's own catalog, most recently added first.
 * Favalog has no comparable popularity signal across TMDB, Open Library, and
 * RAWG, so these shelves say exactly what they are instead of "Trending".
 * Games use landscape artwork; films, series, and books keep poster frames.
 */
export function KindShelf({ kind, items }: KindShelfProps) {
  if (items.length === 0) return null;
  const landscape = kind === "game";

  return (
    <section aria-label={SHELF_TITLE[kind]}>
      <SectionHeader
        title={SHELF_TITLE[kind]}
        description="Recently added to Favalog's catalog. Not a popularity ranking."
        href={`/explore?type=${kind}`}
        linkLabel="Browse all"
        as="h2"
      />
      <ul
        role="list"
        className={
          landscape
            ? "grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
            : "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
        }
      >
        {items.map((item) => (
          <li key={item.id}>
            <MediaCard
              item={item}
              artwork={landscape ? "landscape" : "poster"}
              sizes={
                landscape
                  ? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
