import { ListOrdered } from "lucide-react";
import type { List, MediaItem, User } from "@/lib/types";
import { UserAvatar } from "@/components/user/user-avatar";
import { ListActions } from "@/components/lists/list-actions";
import { itemCountLabel } from "@/components/lists/list-view";
import { cn } from "@/lib/cn";

interface ListHeaderProps {
  list: List;
  owner: User;
  /** The list's resolved contents, used for the size and media-mix summary. */
  media: MediaItem[];
  className?: string;
}

/** Month + year, e.g. "August 2026", for the created/updated line. */
const monthYearFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

/** Collection-level media hint, e.g. "Mixed media" or "Films". */
function mediaSummary(media: MediaItem[]): string {
  const kinds = new Set(media.map((item) => item.kind));
  if (kinds.size > 1) return "Mixed media";
  const [only] = [...kinds];
  switch (only) {
    case "movie":
      return "Films";
    case "tv":
      return "Series";
    case "book":
      return "Books";
    default:
      return "Empty collection";
  }
}

/**
 * The header for an individual list page: the single `h1`, the creator, the
 * description, a restrained metadata line, and the presentation-only Like /
 * Share actions. The creator's avatar is decorative because their name is
 * shown right beside it.
 */
export function ListHeader({ list, owner, media, className }: ListHeaderProps) {
  const updated = new Date(list.updatedAt);

  return (
    <header className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-accent">
          <span>{mediaSummary(media)}</span>
          {list.isRanked && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-foreground/50">
                <ListOrdered className="size-3" aria-hidden="true" />
                Ranked
              </span>
            </>
          )}
        </div>

        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          {list.title}
        </h1>

        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <UserAvatar user={owner} size="sm" decorative />
          <span>
            A list by{" "}
            <span className="text-foreground">{owner.displayName}</span>
          </span>
        </div>
      </div>

      {list.description && (
        <p className="max-w-2xl text-base leading-relaxed text-foreground/70">
          {list.description}
        </p>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/50">
        <span className="tabular-nums">{itemCountLabel(media.length)}</span>
        <span aria-hidden="true">·</span>
        <span>
          Updated{" "}
          <time dateTime={list.updatedAt}>
            {monthYearFormatter.format(updated)}
          </time>
        </span>
      </p>

      <ListActions likeCount={list.likeCount} />
    </header>
  );
}
