import Link from "next/link";
import { Heart, ListOrdered } from "lucide-react";
import { UserAvatar } from "@/components/user/user-avatar";
import { ListPreviewCovers } from "@/components/lists/list-preview-covers";
import {
  itemCountLabel,
  likeCountLabel,
  type ListCardView,
} from "@/components/lists/list-view";
import { cn } from "@/lib/cn";

interface ListCardProps {
  list: ListCardView;
  className?: string;
}

/** Collection-level media hint, e.g. "Mixed media" or "Films". */
function kindsSummary(list: ListCardView): string {
  if (list.kinds.length > 1) return "Mixed media";
  switch (list.kinds[0]) {
    case "movie":
      return "Films";
    case "tv":
      return "Series";
    case "book":
      return "Books";
    default:
      return "Collection";
  }
}

/**
 * Editorial preview of a single list, linking to `/list/[slug]`.
 *
 * The whole card is one anchor so the fanned cover art, title, and metadata
 * are a single large target. Route identity always comes from `slug`, never
 * from the display title, so renaming a list never breaks its URL. The
 * accessible name is set explicitly (title + creator + size) because the
 * cover art is decorative and the creator avatar is unlabeled.
 */
export function ListCard({ list, className }: ListCardProps) {
  const href = `/list/${list.slug}`;
  const accessibleName = `${list.title} — a list by ${list.owner.displayName}, ${itemCountLabel(
    list.itemCount,
  )}`;

  return (
    <article className={cn("group", className)}>
      <Link
        href={href}
        aria-label={accessibleName}
        className="flex h-full flex-col gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ListPreviewCovers
          covers={list.covers}
          className="px-2 pt-2 transition-transform duration-500 group-hover:-translate-y-0.5"
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-foreground/50">
            <span>{kindsSummary(list)}</span>
            {list.isRanked && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <ListOrdered className="size-3" aria-hidden="true" />
                  Ranked
                </span>
              </>
            )}
          </div>

          <h3 className="font-display text-lg leading-snug text-foreground group-hover:text-accent">
            {list.title}
          </h3>

          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <UserAvatar user={list.owner} size="sm" decorative />
            <span className="truncate">{list.owner.displayName}</span>
          </div>

          {list.description && (
            <p className="line-clamp-2 text-sm text-foreground/60">
              {list.description}
            </p>
          )}

          <div className="mt-1 flex items-center gap-3 text-xs text-foreground/50 tabular-nums">
            <span>{itemCountLabel(list.itemCount)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden="true" />
              {likeCountLabel(list.likeCount)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
