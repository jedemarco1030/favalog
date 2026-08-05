import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProfileStats } from "@/components/user/profile-stats";
import { getUserProfileStats } from "@/lib/data";
import type { ProfileStat } from "@/components/user/profile-stats";

function statItemsFor(userId: string): ProfileStat[] {
  const stats = getUserProfileStats(userId);
  return [
    { label: "Movies watched", value: stats.moviesWatched },
    { label: "Shows watched", value: stats.showsWatched },
    { label: "Books read", value: stats.booksRead },
    { label: "Reviews", value: stats.reviews },
    { label: "Lists", value: stats.lists },
    {
      label: "Average rating",
      value: stats.averageRating != null ? stats.averageRating.toFixed(1) : "—",
    },
  ];
}

const meta = {
  title: "User/ProfileStats",
  component: ProfileStats,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileStats>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full profile band, derived from the demo user's mock data. */
export const FullProfile: Story = {
  args: { stats: statItemsFor("u_ari") },
};

/** A brand-new profile: everything zero and no average rating yet. */
export const EmptyProfile: Story = {
  args: {
    stats: [
      { label: "Movies watched", value: 0 },
      { label: "Shows watched", value: 0 },
      { label: "Books read", value: 0 },
      { label: "Reviews", value: 0 },
      { label: "Lists", value: 0 },
      { label: "Average rating", value: "—" },
    ],
  },
};

/** A compact subset — useful where only headline counts are shown. */
export const Compact: Story = {
  args: { stats: statItemsFor("u_ari").slice(0, 3) },
};
