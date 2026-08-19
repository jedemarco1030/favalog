"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { ListDetailItemView } from "@/lib/supabase/list-view-model";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { RealListPoster } from "@/components/lists/real-list-poster";
import { RemoveListItemDialog } from "@/components/lists/remove-list-item-dialog";
import type { ListItemAction } from "@/components/lists/add-to-list-dialog";

interface RealListItemsProps {
  listId: string;
  listTitle: string;
  isRanked: boolean;
  /** True only for the owner; drives the remove controls. */
  isOwner: boolean;
  items: ListDetailItemView[];
  /** Safe, same-origin `returnTo` (this list route). */
  returnTo: string;
  /** The remove-item Server Action, injected (never imported here). */
  removeAction: ListItemAction;
}

/**
 * The ordered contents of a real list.
 *
 * Items render in their stored `position` order (already sorted in the view
 * model), which doubles as the one-based rank for ranked lists. Only the owner
 * sees a per-item "Remove from list" control, which opens an explicit
 * confirmation ({@link RemoveListItemDialog}) naming both the title and the
 * list. Non-owners see no mutation controls at all. Missing poster art falls
 * back to a neutral, kind-aware tile rather than a broken image.
 */
export function RealListItems({
  listId,
  listTitle,
  isRanked,
  isOwner,
  items,
  returnTo,
  removeAction,
}: RealListItemsProps) {
  const [removing, setRemoving] = useState<ListDetailItemView | null>(null);

  return (
    <>
      <ol className="flex flex-col gap-6">
        {items.map((item, index) => (
          <li key={item.mediaId}>
            <article className="flex gap-4 sm:gap-5">
              {isRanked && (
                <span
                  aria-hidden="true"
                  className="w-6 shrink-0 pt-1 text-right font-display text-lg text-foreground/40 tabular-nums sm:w-8 sm:text-xl"
                >
                  {index + 1}
                </span>
              )}

              <Link
                href={`/title/${item.slug}`}
                aria-label={`View ${item.title}`}
                tabIndex={-1}
                className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <RealListPoster
                  posterUrl={item.posterUrl}
                  title={item.title}
                  kind={item.kind}
                  decorative
                  className="w-14 sm:w-16"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/50">
                  <MediaTypeBadge kind={item.kind} />
                  <span className="tabular-nums">{item.year}</span>
                </div>

                <h3 className="font-display text-base leading-snug text-foreground sm:text-lg">
                  <Link
                    href={`/title/${item.slug}`}
                    className="rounded outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {item.title}
                  </Link>
                </h3>
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setRemoving(item)}
                  aria-label={`Remove ${item.title} from ${listTitle}`}
                  title={`Remove ${item.title} from ${listTitle}`}
                  className="inline-flex size-9 shrink-0 items-center justify-center self-start rounded-full border border-border/60 bg-surface-1 text-foreground/60 outline-none transition-colors hover:border-border hover:text-red-300 focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </article>
          </li>
        ))}
      </ol>

      {isOwner && (
        // Kept mounted (open toggles) so closing restores focus to the
        // triggering remove control; the current item's details are passed in.
        <RemoveListItemDialog
          open={removing !== null}
          onClose={() => setRemoving(null)}
          listId={listId}
          listTitle={listTitle}
          mediaSlug={removing?.slug ?? ""}
          mediaTitle={removing?.title ?? ""}
          returnTo={returnTo}
          action={removeAction}
        />
      )}
    </>
  );
}
