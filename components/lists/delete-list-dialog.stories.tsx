import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeleteListDialog } from "@/components/lists/delete-list-dialog";
import type { DeleteListFormState } from "@/app/lists/list-form";

/**
 * The accessible, deliberate confirmation for deleting an entire real list.
 * Opening never deletes; the owner must first acknowledge a checkbox that names
 * the list, then confirm the clearly-named destructive action. The delete
 * Server Action is injected, so this story drives it with a no-op and never
 * imports a server-only module. `open` is forced so the alert dialog renders in
 * the frame.
 */
const noopAction = async (): Promise<DeleteListFormState> => ({
  status: "idle",
});

const meta = {
  title: "Lists/DeleteListDialog",
  component: DeleteListDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    listId: "11111111-1111-1111-1111-111111111111",
    listTitle: "Favorite Sci-Fi",
    returnTo: "/list/favorite-sci-fi",
    action: noopAction,
  },
} satisfies Meta<typeof DeleteListDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The confirmation, naming the list and gating the destructive button. */
export const Default: Story = {};

/** A failure result surfaces a safe banner without leaking database detail. */
export const Error: Story = {
  args: {
    action: async (): Promise<DeleteListFormState> => ({
      status: "error",
      message: "We couldn't delete that list just now. Please try again.",
    }),
  },
};
