import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RatingInput } from "@/components/media/rating-input";

/**
 * The keyboard-accessible half-star rating control used inside the title
 * logging dialog. Rendered inside a `<form>` so the reusable states below
 * reflect how it submits its value.
 */
const meta = {
  title: "Media/RatingInput",
  component: RatingInput,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <form className="max-w-md">
        <Story />
      </form>
    ),
  ],
} satisfies Meta<typeof RatingInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unrated: Story = { args: { defaultValue: null } };
export const HalfStar: Story = { args: { defaultValue: 0.5 } };
export const Preselected: Story = { args: { defaultValue: 4.5 } };
export const FullMarks: Story = { args: { defaultValue: 5 } };
export const Invalid: Story = {
  args: { defaultValue: null, invalid: true },
};
