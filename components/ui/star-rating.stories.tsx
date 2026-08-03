import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StarRating } from "@/components/ui/star-rating";

const meta = {
  title: "UI/StarRating",
  component: StarRating,
  parameters: { layout: "centered" },
  args: { value: 4.5 },
} satisfies Meta<typeof StarRating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HalfStar: Story = { args: { value: 4.5 } };
export const FullMarks: Story = { args: { value: 5 } };
export const LowScore: Story = { args: { value: 2 } };
export const WithNumeric: Story = { args: { value: 3.5, showNumeric: true } };
