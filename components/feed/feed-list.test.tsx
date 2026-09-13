import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedList } from "@/components/feed/feed-list";
import {
  diaryItem,
  diaryWithReviewItem,
  rewatchItem,
  standaloneReviewItem,
} from "@/components/feed/feed-fixtures";
import type { LoadMoreFeedResult } from "@/app/feed/feed-page-state";
import type { FeedActivityView } from "@/lib/supabase/feed-view-model";

/**
 * Pagination behaviour: pages append without duplicating an item, the button
 * reports its pending state, the end of the feed is stated honestly, and a
 * failed page is retryable without discarding what was already read.
 */
function okPage(
  items: FeedActivityView[],
  nextCursor: string | null,
): LoadMoreFeedResult {
  return {
    status: "ok",
    items,
    nextCursor,
    hasMore: nextCursor !== null,
  };
}

describe("FeedList", () => {
  it("appends the next page and then reports the end of the feed", async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(cursor: string) => Promise<LoadMoreFeedResult>>()
      .mockResolvedValue(okPage([standaloneReviewItem], null));

    render(
      <FeedList
        initialItems={[diaryItem, diaryWithReviewItem]}
        initialCursor="v1:2026-09-09T09:05:00.000000+00:00:diary:22222222-2222-2222-2222-222222222222"
        initialHasMore
        loadMore={loadMore}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(loadMore).toHaveBeenCalledWith(
      "v1:2026-09-09T09:05:00.000000+00:00:diary:22222222-2222-2222-2222-222222222222",
    );
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("never renders the same activity twice when a page overlaps", async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(cursor: string) => Promise<LoadMoreFeedResult>>()
      .mockResolvedValue(okPage([diaryItem, rewatchItem], null));

    render(
      <FeedList
        initialItems={[diaryItem]}
        initialCursor="v1:2026-09-10T18:30:00.000000+00:00:diary:11111111-1111-1111-1111-111111111111"
        initialHasMore
        loadMore={loadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("keeps the loaded items and offers a retry when a page fails", async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(cursor: string) => Promise<LoadMoreFeedResult>>()
      .mockResolvedValueOnce({ status: "error", message: "Feed page failed." })
      .mockResolvedValueOnce(okPage([standaloneReviewItem], null));

    render(
      <FeedList
        initialItems={[diaryItem]}
        initialCursor="cursor-1"
        initialHasMore
        loadMore={loadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Feed page failed.");
    expect(screen.getAllByRole("article")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers no pagination control when the server said there is nothing more", () => {
    render(
      <FeedList
        initialItems={[diaryItem]}
        initialCursor={null}
        initialHasMore
        loadMore={vi.fn()}
      />,
    );

    // Without a usable cursor no further page can honestly be promised.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("starts from empty accumulated state when the viewer key changes", async () => {
    const user = userEvent.setup();
    const loadMore = vi
      .fn<(cursor: string) => Promise<LoadMoreFeedResult>>()
      .mockResolvedValue(okPage([standaloneReviewItem], null));

    const { rerender } = render(
      <FeedList
        key="viewer-a"
        initialItems={[diaryItem]}
        initialCursor="cursor-1"
        initialHasMore
        loadMore={loadMore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);

    // A different viewer: the parent remounts with that viewer's own page one,
    // so the previous viewer's appended pages are gone.
    rerender(
      <FeedList
        key="viewer-b"
        initialItems={[rewatchItem]}
        initialCursor={null}
        initialHasMore={false}
        loadMore={loadMore}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("rewatched")).toBeInTheDocument();
  });
});
