import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FavoriteButton } from "@/components/media/favorite-button";
import type { FavoriteFormState } from "@/app/title/[slug]/favorite-form";

/**
 * The accessible Favorite / Favorited toggle for a signed-in, onboarded viewer.
 * It is presentational: the set-favorite Server Action is injected, so these
 * stories drive it with a mock returning a resolved success state that flips
 * the desired value — never importing a `"use server"` module. The displayed
 * pressed state is server truth, so after a click it reflects the ACTUAL
 * returned state.
 */

/** Toggle mock: returns the desired next state the form submitted. */
const toggleAction = async (
  _state: FavoriteFormState,
  formData: FormData,
): Promise<FavoriteFormState> => ({
  status: "success",
  isFavorite: formData.get("isFavorite") === "true",
  slug: "afterglow",
});

const meta = {
  title: "Media/FavoriteButton",
  component: FavoriteButton,
  parameters: { layout: "centered" },
  args: {
    mediaSlug: "afterglow",
    mediaTitle: "Afterglow",
    returnTo: "/title/afterglow",
    initialIsFavorite: false,
    available: true,
    action: toggleAction,
  },
} satisfies Meta<typeof FavoriteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Neutral, unpressed state — the viewer hasn't favorited this title. */
export const Neutral: Story = {};

/** Pressed state — the viewer has already favorited this title. */
export const Favorited: Story = { args: { initialIsFavorite: true } };

/**
 * Controlled unavailable state — the catalog slug can't be resolved to the
 * persistent store, so the control is disabled with a safe explanation.
 */
export const Unavailable: Story = { args: { available: false } };

/** A write failure surfaces a controlled, accessible error message. */
export const WriteError: Story = {
  args: {
    action: async (): Promise<FavoriteFormState> => ({
      status: "error",
      message: "We couldn't update your favorites just now. Please try again.",
    }),
  },
};
