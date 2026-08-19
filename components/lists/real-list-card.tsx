import Link from "next/link";
import { Globe, ListOrdered, Lock } from "lucide-react";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { itemCountLabel } from "@/components/lists/list-view";
import {
  formatUpdatedAt,
  isPrivateVisibility,
  visibilityLabel,
} from "@/components/lists/real-list-format";
import type {
  ListSummaryView,
  ListOwnerView,
} from "@/lib/supabase/list-view-model";
import { cn } from "@/lib/cn";

interface RealListCardProps {
  list: ListSummaryView;
  /** When present, the card shows real owner identity (community section). */
  owner?: ListOwnerView;
  /**
   * When true, the private/public status is surfaced. Use for owner-facing
   * surfaces ("Your lists", the owner's own profile) so private lists are
   * clearly identified. Community/public surfaces can leave it off.
   */
  showVisibility?: boolean;
  className?: string;
}

/**
 * A card for a real (persistent) list, built from a serializable
 * {@link ListSummaryView} — never a raw database row.
 *
 * Unlike the mock `ListCard`, it shows only what is actually stored: title,
 * item count, ranked state, updated date, optional owner identity, and (for
 * owner surfaces) public/private status. It deliberately renders NO fabricated
 * cover art, like count, or curator notes, because real lists don't carry them
 * this phase. Route identity always comes from the stable `slug`.
 */
export function RealListCard({
  list,
  owner,
  showVisibility = false,
  className,
}: RealListCardProps) {
  const href = `/list/${list.slug}`;
  const isPrivate = isPrivateVisibility(list.visibility);
  const updated = formatUpdatedAt(list.updatedAt);
  const accessibleName = owner
    ? `${list.title} — a list by ${owner.displayName}, ${itemCountLabel(list.itemCount)}`
    : `${list.title} — ${itemCountLabel(list.itemCount)}`;

  return (
    <article
      className={cn(
        "group rounded-xl border border-border/60 bg-surface-1 transition-colors hover:border-border",
        className,
      )}
    >
      <Link
        href={href}
        aria-label={accessibleName}
        className="flex h-full flex-col gap-3 rounded-xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-foreground/50">
          {list.isRanked && (
            <span className="inline-flex items-center gap-1">
              <ListOrdered className="size-3" aria-hidden="true" />
              Ranked
            </span>
          )}
          {showVisibility && (
            <>
              {list.isRanked && <span aria-hidden="true">·</span>}
              <span className="inline-flex items-center gap-1">
                {isPrivate ? (
                  <Lock className="size-3" aria-hidden="true" />
                ) : (
                  <Globe className="size-3" aria-hidden="true" />
                )}
                {visibilityLabel(list.visibility)}
              </span>
            </>
          )}
        </div>

        <h3 className="font-display text-lg leading-snug text-foreground group-hover:text-accent">
          {list.title}
        </h3>

        {owner && (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <ProfileAvatar
              displayName={owner.displayName}
              avatarUrl={owner.avatarUrl}
              size="sm"
              decorative
            />
            <span className="truncate">{owner.displayName}</span>
          </div>
        )}

        {list.description && (
          <p className="line-clamp-2 text-sm text-foreground/60">
            {list.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-foreground/50 tabular-nums">
          <span>{itemCountLabel(list.itemCount)}</span>
          {updated && (
            <>
              <span aria-hidden="true">·</span>
              <span className="normal-case">
                Updated <time dateTime={list.updatedAt}>{updated}</time>
              </span>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
