import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReviewCard } from "@/components/reviews/review-card";
import { getMediaById, getUserById, reviews } from "@/lib/data";

const movieReview = reviews[0]; // Afterglow (film)
const bookReview = reviews[2]; // The Small Hours (book)
const longReview = reviews[3]; // Dune: Part Two — longer body

const meta = {
  title: "Reviews/ReviewCard",
  component: ReviewCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MovieReview: Story = {
  args: {
    review: movieReview,
    user: getUserById(movieReview.userId)!,
    media: getMediaById(movieReview.mediaId)!,
  },
};

export const BookReview: Story = {
  args: {
    review: bookReview,
    user: getUserById(bookReview.userId)!,
    media: getMediaById(bookReview.mediaId)!,
  },
};

export const LongerCopy: Story = {
  args: {
    review: longReview,
    user: getUserById(longReview.userId)!,
    media: getMediaById(longReview.mediaId)!,
  },
};
