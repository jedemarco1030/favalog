"use client";

import { useCallback, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { FeedCard, type FeedLikeContext } from "@/components/feed/feed-card";
import type {
  LoadMoreFeedAction,
  LoadMoreFeedResult,
} from "@/app/feed/feed-page-state";
import type { FeedActivityView } from "@/lib/supabase/feed-view-model";
import { cn } from "@/lib/cn";

interface FeedListProps {
  /**
   * The server-rendered first page. Subsequent pages are appended to it.
   */
  initialItems: FeedActivityView[];
  initialCursor: string | null;
  initialHasMore: boolean;
  /** The "load the next page" Server Action, injected (never imported here). */
  loadMore: LoadMoreFeedAction;
  /** When present, real Like controls are shown on review-bearing cards. */
  like?: FeedLikeContext;
  className?: string;
}

/**
 * The client half of `/feed`: it renders the server-provided first page and
 * appends further pages on demand.
 *
 * State rules that keep it honest:
 *
 *   - accumulation is append-only and de-duplicated by the stable item key, so
 *     a repeated or overlapping page can never render the same activity twice;
 *   - the cursor is only a POSITION — the action re-authenticates and
 *     re-evaluates the viewer's current follows for every page, so an unfollow
 *     between pages takes effect immediately;
 *   - a failed page keeps the already-loaded items and offers a retry instead
 *     of discarding the feed; and
 *   - the parent keys this component by viewer identity, so switching accounts
 *     REMOUNTS it with empty accumulated state rather than reusing the previous
 *     viewer's pages.
 */
export function FeedList({
  initialItems,
  initialCursor,
  initialHasMore,
  loadMore,
  className,
}: FeedListProps) {
  const [items, setItems] = useState<FeedActivityView[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(
    initialHasMore && initialCursor !== null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const appendPage = useCallback((result: LoadMoreFeedResult) => {
    if (result.status !== "ok") {
      setError(result.message);
      return;
    }
    setError(null);
    setItems((current) => {
      const seen = new Set(current.map((item) => item.key));
      return [
        ...current,
        ...result.items.filter((item) => !seen.has(item.key)),
      ];
    });
    setCursor(result.nextCursor);
    setHasMore(result.hasMore && result.nextCursor !== null);
  }, []);

  const onLoadMore = useCallback(() => {
    if (cursor === null || isPending) return;
    startTransition(async () => {
      appendPage(await loadMore(cursor));
    });
  }, [appendPage, cursor, isPending, loadMore]);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.key}>
            <FeedCard item={item} />
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-1 px-5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent",
              isPending && "cursor-not-allowed opacity-60",
            )}
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {error ? "Try again" : "Load more"}
          </button>
        ) : (
          items.length > 0 && (
            <p className="text-sm text-foreground/50">
              You&rsquo;re all caught up.
            </p>
          )
        )}

        <p role="status" aria-live="polite" className="sr-only">
          {isPending ? "Loading more activity…" : ""}
        </p>
      </div>
    </div>
  );
}
