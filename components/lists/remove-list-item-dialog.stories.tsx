import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RemoveListItemDialog } from "@/components/lists/remove-list-item-dialog";
import type { ListItemFormState } from "@/app/lists/list-form";

/**
 * The accessible, two-step confirmation for removing a title from a real list.
 * Opening never removes; the owner must confirm the clearly-named destructive
 * action. The remove Server Action is injected, so this story drives it with a
 * no-op and never imports a server-only module. `open` is forced so the alert
 * dialog renders in the frame.
 */
const noopAction = async (): Promise<ListItemFormState> => ({
  status: "idle",
});

const meta = {
  title: "Lists/RemoveListItemDialog",
  component: RemoveListItemDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    listId: "11111111-1111-1111-1111-111111111111",
    listTitle: "Favorite Sci-Fi",
    mediaSlug: "afterglow",
    mediaTitle: "Afterglow",
    returnTo: "/list/favorite-sci-fi",
    action: noopAction,
  },
} satisfies Meta<typeof RemoveListItemDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The confirmation, naming both the title and the list it is removed from. */
export const Default: Story = {};
