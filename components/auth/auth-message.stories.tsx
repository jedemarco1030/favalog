import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthMessage } from "@/components/auth/auth-message";

const meta = {
  title: "Auth/AuthMessage",
  component: AuthMessage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AuthMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  args: {
    variant: "error",
    children: "The email or password you entered is incorrect.",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    children:
      "If an account exists for that email, we've sent a link to reset your password.",
  },
};

export const Info: Story = {
  args: {
    variant: "info",
    children: "Please check your inbox to confirm your email address.",
  },
};

export const Pending: Story = {
  args: {
    variant: "pending",
    children: "Verifying your credentials...",
  },
};
