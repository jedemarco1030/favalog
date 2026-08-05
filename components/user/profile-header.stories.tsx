import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProfileHeader } from "@/components/user/profile-header";
import { getUserByUsername, getUserFavorites } from "@/lib/data";
import type { User } from "@/lib/types";

const jamie = getUserByUsername("jamie")!;
const covers = getUserFavorites(jamie.id);

const longBio: User = {
  ...jamie,
  bio: "Software engineer, hockey fan, movie watcher, book reader, and lifelong collector of stories — always chasing the next quiet sci-fi, the next slow-burn drama, and the one novel that ruins every book after it.",
};

const noLocation: User = { ...jamie, location: undefined };

const meta = {
  title: "User/ProfileHeader",
  component: ProfileHeader,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The current viewer's own profile: cover collage + presentation-only Edit action. */
export const CurrentUser: Story = {
  args: { user: jamie, isCurrentUser: true, coverMedia: covers },
};

/** Another person's profile: identical layout, no Edit action. */
export const OtherUser: Story = {
  args: { user: jamie, isCurrentUser: false, coverMedia: covers },
};

/** A long bio that must wrap without breaking the layout. */
export const LongBio: Story = {
  args: { user: longBio, isCurrentUser: true, coverMedia: covers },
};

/** No location set — the join date carries the metadata line alone. */
export const MissingLocation: Story = {
  args: { user: noLocation, isCurrentUser: true, coverMedia: covers },
};

/** No favorites yet, so the decorative cover collage is omitted. */
export const NoCover: Story = {
  args: { user: jamie, isCurrentUser: true, coverMedia: [] },
};
