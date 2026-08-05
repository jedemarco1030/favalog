import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FavoriteMediaGrid } from "@/components/user/favorite-media-grid";
import { getUserFavorites } from "@/lib/data";

const favorites = getUserFavorites("u_ari");

const meta = {
  title: "User/FavoriteMediaGrid",
  component: FavoriteMediaGrid,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FavoriteMediaGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A mixed movies/TV/books shelf — each card labels its kind and links out. */
export const MixedMedia: Story = {
  args: { items: favorites },
};

/** A shorter shelf, e.g. a profile with only a few favorites chosen. */
export const FewItems: Story = {
  args: { items: favorites.slice(0, 3) },
};
