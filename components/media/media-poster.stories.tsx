import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MediaPoster } from "@/components/media/media-poster";
import { getMediaBySlug } from "@/lib/data";

const movie = getMediaBySlug("afterglow")!;
const book = getMediaBySlug("the-small-hours")!;

const meta = {
  title: "Media/MediaPoster",
  component: MediaPoster,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 180 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MediaPoster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MoviePoster: Story = {
  args: { item: movie, sizes: "180px" },
};

export const BookCover: Story = {
  args: { item: book, sizes: "180px" },
};

export const WideRatio: Story = {
  args: { item: movie, sizes: "320px", ratio: "16/9" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
