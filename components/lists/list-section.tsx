import { ListCard } from "@/components/lists/list-card";
import type { ListCardView } from "@/components/lists/list-view";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";

interface ListSectionProps {
  title: string;
  description?: string;
  lists: ListCardView[];
  /** Heading level for the section title. Defaults to `h2`. */
  as?: "h2" | "h3";
  className?: string;
}

/** Shared responsive grid classes for every collection of `ListCard`s. */
export const LIST_GRID_CLASS =
  "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3";

/**
 * A titled block of `ListCard`s used to organize the discovery index into
 * sections (Popular, From your circle, Recently updated, Staff picks). Renders
 * nothing when it has no lists so empty sections never leave a dangling
 * heading.
 */
export function ListSection({
  title,
  description,
  lists,
  as = "h2",
  className,
}: ListSectionProps) {
  if (lists.length === 0) return null;

  return (
    <section className={cn(className)} aria-label={title}>
      <SectionHeader as={as} title={title} description={description} />
      <ul role="list" className={LIST_GRID_CLASS}>
        {lists.map((list) => (
          <li key={list.id}>
            <ListCard list={list} />
          </li>
        ))}
      </ul>
    </section>
  );
}
