import type { MediaItem } from "@/lib/types";
import { MediaCard } from "@/components/media/media-card";
import { SectionHeader } from "@/components/ui/section-header";
import {
  releaseLabel,
  releaseWindowStartYear,
  type ReleaseShelf as ReleaseShelfData,
} from "@/lib/home/releases";

interface ReleaseShelfProps {
  shelf: ReleaseShelfData;
  currentYear: number;
}

/**
 * Recent and upcoming releases by the stored release YEAR. The description
 * states the window and the year-only precision so nothing reads as a
 * day-accurate "out now" claim, and import time never qualifies a title.
 */
export function ReleaseShelf({ shelf, currentYear }: ReleaseShelfProps) {
  const items: MediaItem[] = [...shelf.upcoming, ...shelf.recent];
  if (items.length === 0) return null;
  const start = releaseWindowStartYear(currentYear);

  return (
    <section aria-label="Recent and upcoming releases">
      <SectionHeader
        title="Recent and upcoming releases"
        description={`Titles with a release year from ${start} on. Dates are year-only and not regional, so a ${currentYear} title may not be out yet.`}
        href="/explore"
        linkLabel="Explore"
        as="h2"
      />
      <ul
        role="list"
        className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
      >
        {items.map((item) => (
          <li key={item.id}>
            <MediaCard
              item={item}
              meta={releaseLabel(item.year, currentYear) ?? undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
