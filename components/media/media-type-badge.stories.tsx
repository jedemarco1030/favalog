import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MediaTypeBadge } from "@/components/media/media-type-badge";

const meta = {
  title: "Media/MediaTypeBadge",
  component: MediaTypeBadge,
  parameters: { layout: "centered" },
} satisfies Meta<typeof MediaTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Movie: Story = { args: { kind: "movie" } };
export const TV: Story = { args: { kind: "tv" } };
export const Book: Story = { args: { kind: "book" } };
