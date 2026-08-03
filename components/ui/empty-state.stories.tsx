import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Your diary is empty.",
    description: "Titles you log will show up here, newest first.",
  },
};

export const SearchEmpty: Story = {
  args: {
    icon: Search,
    title: "No matches yet.",
    description: "Try a different title, creator, or genre.",
  },
};
