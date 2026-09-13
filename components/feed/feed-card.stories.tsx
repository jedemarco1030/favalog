import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FeedCard } from "@/components/feed/feed-card";
import {
  diaryItem,
  diaryWithReviewItem,
  rewatchItem,
  standaloneReviewItem,
} from "@/components/feed/feed-fixtures";

/**
 * One activity item in the following feed, built from a serializable
 * `FeedActivityView`. Everything shown is source-backed: the verb comes from
 * the diary entry, the rating is the diary-resolved rating, and the excerpt is
 * a real review. These stories cover the genuinely different shapes the reader
 * produces.
 */
const meta = {
  title: "Feed/FeedCard",
  component: FeedCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
  args: { item: diaryItem },
} satisfies Meta<typeof FeedCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A plain diary log with a rating — no review was written. */
export const DiaryLog: Story = {};

/**
 * A diary log and its linked review as ONE card (the deduplication happens in
 * SQL). The verb stays the log's verb, and the backdated diary date is shown
 * next to the record time.
 */
export const DiaryLogWithReview: Story = {
  args: { item: diaryWithReviewItem },
};

/** A standalone review — the only case that reads "reviewed". */
export const StandaloneReviewWithSpoilers: Story = {
  args: { item: standaloneReviewItem },
};

/** A revisit: "rewatched" rather than "watched". */
export const Rewatch: Story = { args: { item: rewatchItem } };

/** Long review content stays bounded and does not break the layout. */
export const LongContent: Story = {
  args: {
    item: {
      ...diaryWithReviewItem,
      review: {
        id: "77777777-7777-7777-7777-777777777777",
        containsSpoilers: false,
        title:
          "A patient, devastating book that I will be thinking about for a very long time",
        excerpt:
          "It takes its time, and every page of that time is earned — the kind of slow accumulation that only reveals what it was building towards in the final thirty pages, by which point it is far too late to put it down…",
      },
    },
  },
};
