import type { MediaItem } from "@/lib/types";
import { MediaCard } from "@/components/media/media-card";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

interface HorizontalMediaRowProps {
  title: string;
  description?: string;
  items: MediaItem[];
  /** Optional "browse all" destination for the section header. */
  href?: string;
  linkLabel?: string;
  /** Prioritise the first card's image (use on above-the-fold hero rails). */
  priorityFirst?: boolean;
  className?: string;
  emptyLabel?: string;
}

/**
 * Titled row of media posters. Uses a responsive grid rather than a
 * scroll-snap carousel so we keep the layout Server-Component friendly
 * and Lighthouse-friendly.
 */
export function HorizontalMediaRow({
  title,
  description,
  items,
  href,
  linkLabel,
  priorityFirst = false,
  className,
  emptyLabel = "Nothing here yet.",
}: HorizontalMediaRowProps) {
  return (
    <section className={cn(className)} aria-label={title}>
      <SectionHeader
        title={title}
        description={description}
        href={href}
        linkLabel={linkLabel}
      />
      {items.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <ul
          role="list"
          className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
        >
          {items.map((item, index) => (
            <li key={item.id}>
              <MediaCard item={item} priority={priorityFirst && index === 0} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
