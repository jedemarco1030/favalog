import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { AccountMenu } from "@/components/layout/account-menu";

const menuItemClass =
  "block w-full px-4 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-surface-2 hover:text-foreground";

const meta = {
  title: "Layout/AccountMenu",
  component: AccountMenu,
  parameters: { layout: "padded" },
  args: {
    displayName: "Jamie DeMarco",
    avatarUrl: null,
    children: (
      <>
        <Link href="/profile/jamie" role="menuitem" className={menuItemClass}>
          View profile
        </Link>
        <button type="button" role="menuitem" className={menuItemClass}>
          Sign out
        </button>
      </>
    ),
  },
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Initials fallback (no uploaded avatar). Click the trigger to open the menu. */
export const Default: Story = {};

/** With an uploaded avatar image. */
export const WithAvatar: Story = {
  args: {
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jamie",
  },
};
