import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  FeedErrorState,
  FeedNoActivityState,
  FeedNoFollowsState,
  FeedSignedOutState,
  FeedUnavailableState,
} from "@/components/feed/feed-states";

/**
 * The feed's non-content states. They are deliberately DIFFERENT messages:
 * "you follow nobody" is not the same truth as "the people you follow haven't
 * logged anything", and a failed read is never dressed up as an empty feed or
 * replaced with example activity.
 */
const meta = {
  title: "Feed/FeedStates",
  component: FeedNoFollowsState,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FeedNoFollowsState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Following nobody yet — explained, with a route to finding people. */
export const NoFollows: Story = {};

/** Signed out — an invitation through the safe `returnTo` sign-in flow. */
export const SignedOut: Story = {
  render: () => <FeedSignedOutState returnTo="/feed" />,
};

/** Following people who simply have not logged anything yet. */
export const NoActivity: Story = { render: () => <FeedNoActivityState /> };

/** A configured read failed — retryable, never a mock substitution. */
export const ReadError: Story = { render: () => <FeedErrorState /> };

/** No Supabase configuration: clearly labelled unavailable. */
export const Unavailable: Story = { render: () => <FeedUnavailableState /> };
