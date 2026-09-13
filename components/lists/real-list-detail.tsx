import Link from "next/link";
import { Globe, ListOrdered, Lock, Users } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { itemCountLabel } from "@/components/lists/list-view";
import {
  formatUpdatedAt,
  toCreateVisibility,
  visibilityLabel,
} from "@/components/lists/real-list-format";
import { RealListItems } from "@/components/lists/real-list-items";
import { RealListOwnerActions } from "@/components/lists/real-list-owner-actions";
import { ShareListButton } from "@/components/lists/share-list-button";
import {
  deleteListAction,
  editListAction,
  removeListItemAction,
} from "@/app/lists/actions";
import type { ListDetailView } from "@/lib/supabase/list-view-model";
import type { MediaKind } from "@/lib/types";

interface RealListDetailProps {
  list: ListDetailView;
}

/** Collection-level media hint, e.g. "Mixed media" / "Films". */
function mediaSummary(kinds: MediaKind[]): string {
  const distinct = new Set(kinds);
  if (distinct.size === 0) return "Empty collection";
  if (distinct.size > 1) return "Mixed media";
  switch ([...distinct][0]) {
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
 * The detail view for a real (persistent) `/list/[slug]`.
 *
 * Renders only stored data from the {@link ListDetailView}: title, description,
 * owner identity, ranked state, updated date, and the ordered items (position
 * is authoritative; ranked lists show one-based ranks). It fabricates no
 * community ratings, notes, covers, or like counts. Visibility is surfaced only
 * to the owner (so a private list is clearly identified); a public list needs
 * no badge. Only the owner sees per-item remove controls. Share is preserved;
 * there is no mock Like toggle and no fake zero-like counter.
 */
export function RealListDetail({ list }: RealListDetailProps) {
  const kinds = list.items.map((item) => item.kind);
  const updated = formatUpdatedAt(list.updatedAt);
  const returnTo = `/list/${list.slug}`;

  return (
    <article>
      <Container className="py-10 md:py-14">
        <header className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-accent">
              <span>{mediaSummary(kinds)}</span>
              {list.isRanked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-foreground/50">
                    <ListOrdered className="size-3" aria-hidden="true" />
                    Ranked
                  </span>
                </>
              )}
              {list.isOwner && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-foreground/50">
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

            <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
              {list.title}
            </h1>

            {list.owner ? (
              <div className="flex items-center gap-2 text-sm text-foreground/70">
                {list.owner.username?.trim() ? (
                  <Link
                    href={`/profile/${list.owner.username}`}
                    className="group/creator inline-flex items-center gap-2 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ProfileAvatar
                      displayName={
                        list.owner.displayName || list.owner.username
                      }
                      avatarUrl={list.owner.avatarUrl}
                      size="sm"
                      decorative
                    />
                    <span>
                      A list by{" "}
                      <span className="text-foreground underline-offset-4 group-hover/creator:underline">
                        {list.owner.displayName || list.owner.username}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="inline-flex items-center gap-2">
                    <ProfileAvatar
                      displayName={list.owner.displayName || "Anonymous"}
                      avatarUrl={list.owner.avatarUrl}
                      size="sm"
                      decorative
                    />
                    <span>
                      A list by{" "}
                      <span className="text-foreground">
                        {list.owner.displayName || "Anonymous"}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {list.description && (
            <p className="max-w-2xl text-base leading-relaxed text-foreground/70">
              {list.description}
            </p>
          )}

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/50">
            <span className="tabular-nums">
              {itemCountLabel(list.items.length)}
            </span>
            {updated && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Updated <time dateTime={list.updatedAt}>{updated}</time>
                </span>
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <ShareListButton />
            {list.isOwner && (
              <RealListOwnerActions
                listId={list.id}
                title={list.title}
                description={list.description}
                isRanked={list.isRanked}
                visibility={toCreateVisibility(list.visibility)}
                returnTo={returnTo}
                editAction={editListAction}
                deleteAction={deleteListAction}
              />
            )}
          </div>
        </header>

        <section aria-label="List contents" className="mt-10">
          {list.items.length > 0 ? (
            <RealListItems
              listId={list.id}
              listTitle={list.title}
              isRanked={list.isRanked}
              isOwner={list.isOwner}
              items={list.items}
              returnTo={returnTo}
              removeAction={removeListItemAction}
            />
          ) : (
            <EmptyState
              title={
                list.isOwner
                  ? "This list is empty."
                  : "This list doesn't have any titles yet."
              }
              description={
                list.isOwner
                  ? "Add titles from any title page to start filling it in."
                  : undefined
              }
            />
          )}
        </section>
      </Container>
    </article>
  );
}
