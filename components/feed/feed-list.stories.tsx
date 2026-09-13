import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FeedList } from "@/components/feed/feed-list";
import {
  diaryItem,
  diaryWithReviewItem,
  rewatchItem,
  standaloneReviewItem,
} from "@/components/feed/feed-fixtures";
import type { LoadMoreFeedResult } from "@/app/feed/feed-page-state";

/**
 * The paginating client list. The "load more" Server Action is INJECTED, so
 * these stories drive the real pagination, pending, end-of-results, and
 * page-error behaviour with plain fakes — Storybook never imports a
 * `"use server"` module.
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadsOnePage(): Promise<LoadMoreFeedResult> {
  await wait(600);
  return {
    status: "ok",
    items: [standaloneReviewItem, rewatchItem],
    nextCursor: null,
    hasMore: false,
  };
}

async function failsToLoad(): Promise<LoadMoreFeedResult> {
  await wait(600);
  return {
    status: "error",
    message: "We couldn't load more activity. Please try again.",
  };
}

const meta = {
  title: "Feed/FeedList",
  component: FeedList,
  parameters: { layout: "padded" },
  args: {
    initialItems: [diaryItem, diaryWithReviewItem],
    initialCursor: "v1:example-cursor",
    initialHasMore: true,
    loadMore: loadsOnePage,
  },
} satisfies Meta<typeof FeedList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A first page with more to come — "Load more" appends the next page. */
export const WithMorePages: Story = {};

/** The end of the feed: no control, just an honest statement. */
export const EndOfFeed: Story = {
  args: { initialCursor: null, initialHasMore: false },
};

/** A failed page keeps what was already read and offers a retry. */
export const PageError: Story = { args: { loadMore: failsToLoad } };
