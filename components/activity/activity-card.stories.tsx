import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActivityCard } from "@/components/activity/activity-card";
import { activity, getMediaById, getUserById } from "@/lib/data";

const reviewed = activity[0]; // reviewed, with rating + excerpt
const finished = activity.find((a) => a.kind === "finished")!;
const rated = activity.find((a) => a.kind === "rated")!;

const meta = {
  title: "Activity/ActivityCard",
  component: ActivityCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewedWithExcerpt: Story = {
  args: {
    activity: reviewed,
    user: getUserById(reviewed.userId)!,
    media: getMediaById(reviewed.mediaId)!,
  },
};

export const Finished: Story = {
  args: {
    activity: finished,
    user: getUserById(finished.userId)!,
    media: getMediaById(finished.mediaId)!,
  },
};

export const Rated: Story = {
  args: {
    activity: rated,
    user: getUserById(rated.userId)!,
    media: getMediaById(rated.mediaId)!,
  },
};
