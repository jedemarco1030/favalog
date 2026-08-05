import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SignedOutControls } from "@/components/layout/signed-out-controls";

const meta = {
  title: "Layout/SignedOutControls",
  component: SignedOutControls,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SignedOutControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
