import Link from "next/link";
import { Globe, ListOrdered, Lock, Users } from "lucide-react";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { itemCountLabel } from "@/components/lists/list-view";
import {
  formatUpdatedAt,
  visibilityLabel,
} from "@/components/lists/real-list-format";
import type {
  ListSummaryView,
  ListOwnerView,
} from "@/lib/supabase/list-view-model";
import { LikeButton, type LikeAction } from "@/components/likes/like-button";
import { cn } from "@/lib/cn";

/**
 * Everything the card needs to render a real Like control for this list.
 * Supplied by a server surface that has already batched the like state and
 * resolved the viewer's auth; omitted on surfaces that don't show likes (e.g.
 * the owner's own management list), where a like toggle adds no value.
 */
export interface ListLikeControl {
  likeCount: number;
  viewerHasLiked: boolean;
  isAuthenticated: boolean;
  signInHref: string;
  returnTo: string;
  action: LikeAction;
}

interface RealListCardProps {
  list: ListSummaryView;
  /** When present, the card shows real owner identity (community section). */
  owner?: ListOwnerView | null;
  /**
   * When true, the private/public status is surfaced. Use for owner-facing
   * surfaces ("Your lists", the owner's own profile) so private lists are
   * clearly identified. Community/public surfaces can leave it off.
   */
  showVisibility?: boolean;
  /** When present, a real Like control is shown for the list. */
  like?: ListLikeControl;
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
  like,
  className,
}: RealListCardProps) {
  const href = `/list/${list.slug}`;
  const updated = formatUpdatedAt(list.updatedAt);
  const hasValidOwnerUsername =
    typeof owner?.username === "string" && owner.username.trim() !== "";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-5 transition-colors hover:border-border",
        className,
      )}
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
              {list.visibility === "private" ? (
                <Lock className="size-3" aria-hidden="true" />
              ) : list.visibility === "followers" ? (
                <Users className="size-3" aria-hidden="true" />
              ) : (
                <Globe className="size-3" aria-hidden="true" />
              )}
              {visibilityLabel(list.visibility)}
            </span>
          </>
        )}
      </div>

      <h3 className="font-display text-lg leading-snug text-foreground group-hover:text-accent">
        <Link
          href={href}
          className="rounded outline-none focus-visible:ring-2 focus-visible:ring-accent after:absolute after:inset-0 after:rounded-xl"
        >
          {list.title}
        </Link>
      </h3>

      {owner && (
        <div className="relative z-10 flex items-center gap-2 text-sm text-foreground/60">
          {hasValidOwnerUsername ? (
            <Link
              href={`/profile/${owner.username}`}
              className="inline-flex items-center gap-2 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ProfileAvatar
                displayName={owner.displayName || owner.username}
                avatarUrl={owner.avatarUrl}
                size="sm"
                decorative
              />
              <span className="truncate underline-offset-4 hover:underline">
                {owner.displayName || owner.username}
              </span>
            </Link>
          ) : (
            <div className="inline-flex items-center gap-2">
              <ProfileAvatar
                displayName={owner.displayName || "Anonymous"}
                avatarUrl={owner.avatarUrl}
                size="sm"
                decorative
              />
              <span className="truncate">
                {owner.displayName || "Anonymous"}
              </span>
            </div>
          )}
        </div>
      )}

      {list.description && (
        <p className="line-clamp-2 text-sm text-foreground/60">
          {list.description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-xs text-foreground/50 tabular-nums">
        <div className="flex min-w-0 items-center gap-2">
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
        {like && (
          <div className="relative z-10 shrink-0">
            <LikeButton
              targetType="list"
              targetId={list.id}
              label={`the list "${list.title}"`}
              initialLikeCount={like.likeCount}
              initialViewerHasLiked={like.viewerHasLiked}
              isAuthenticated={like.isAuthenticated}
              signInHref={like.signInHref}
              returnTo={like.returnTo}
              action={like.action}
            />
          </div>
        )}
      </div>
    </article>
  );
}
