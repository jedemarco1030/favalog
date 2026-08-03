import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MediaCard } from "@/components/media/media-card";
import { getMediaBySlug } from "@/lib/data";
import type { Movie } from "@/lib/types";

const movie = getMediaBySlug("afterglow")!;
const show = getMediaBySlug("northlight")!;
const book = getMediaBySlug("the-small-hours")!;

const longTitleMovie: Movie = {
  ...(movie as Movie),
  id: "m_long_title",
  title:
    "An Extraordinarily and Deliberately Overlong Title That Tests Truncation",
};

const unratedMovie: Movie = {
  ...(movie as Movie),
  id: "m_unrated",
  averageRating: undefined,
};

const meta = {
  title: "Media/MediaCard",
  component: MediaCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MovieVariant: Story = { args: { item: movie } };
export const TVVariant: Story = { args: { item: show } };
export const BookVariant: Story = { args: { item: book } };
export const LongTitle: Story = { args: { item: longTitleMovie } };
export const NoRating: Story = { args: { item: unratedMovie } };

export const Wide: Story = {
  args: { item: movie, variant: "wide" },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
};
