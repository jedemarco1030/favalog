import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LikeButton } from "@/components/likes/like-button";
import type { LikeFormState } from "@/components/likes/like-form";

/**
 * The accessible Like / Liked toggle with a live count, used on real reviews
 * and lists. It is presentational: the set-like Server Action is injected, so
 * these stories drive it with a mock that returns a resolved success state
 * flipping the desired value — never importing a `"use server"` module. The
 * displayed pressed state and count are server truth, so after a click they
 * reflect the ACTUAL values the server returned.
 */

/** Toggle mock: echoes the desired next state and a matching count. */
const toggleAction = async (
  _state: LikeFormState,
  formData: FormData,
): Promise<LikeFormState> => {
  const next = formData.get("isLiked") === "true";
  return { status: "success", isLiked: next, likeCount: next ? 13 : 12 };
};

const meta = {
  title: "Likes/LikeButton",
  component: LikeButton,
  parameters: { layout: "centered" },
  args: {
    targetType: "review",
    targetId: "11111111-1111-4111-8111-111111111111",
    label: "Alice's review of Dune",
    initialLikeCount: 12,
    initialViewerHasLiked: false,
    isAuthenticated: true,
    signInHref: "/auth/sign-in?returnTo=%2Ftitle%2Fdune",
    returnTo: "/title/dune",
    action: toggleAction,
    available: true,
  },
} satisfies Meta<typeof LikeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Neutral, unpressed state — the viewer hasn't liked this yet. */
export const Neutral: Story = {};

/** Pressed state — the viewer has already liked this. */
export const Liked: Story = {
  args: { initialViewerHasLiked: true, initialLikeCount: 13 },
};

/**
 * Signed-out visitor: a real count with a control that routes to the safe
 * sign-in flow instead of a dead or dishonest toggle.
 */
export const SignedOut: Story = { args: { isAuthenticated: false } };

/**
 * Controlled unavailable state — the like service can't be reached for this
 * target, so the control is disabled with a safe explanation.
 */
export const Unavailable: Story = { args: { available: false } };

/** A write failure surfaces a controlled, accessible error message. */
export const WriteError: Story = {
  args: {
    action: async (): Promise<LikeFormState> => ({
      status: "error",
      message: "This item is no longer available.",
    }),
  },
};
