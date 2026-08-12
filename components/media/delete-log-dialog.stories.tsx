import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeleteLogDialog } from "@/components/media/delete-log-dialog";
import type { DeleteFormState } from "@/app/diary/diary-form";

/**
 * The destructive-confirmation dialog for deleting a diary entry. Deletion is a
 * deliberate two-step action (opening never deletes); the action is injected so
 * these stories drive it with a no-op and never import a server-only module.
 */
const noopAction = async (): Promise<DeleteFormState> => ({ status: "idle" });

const meta = {
  title: "Media/DeleteLogDialog",
  component: DeleteLogDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    action: noopAction,
    diaryEntryId: "11111111-1111-1111-1111-111111111111",
    title: "Dune: Part Two",
    loggedAt: "2026-08-02T21:30:00.000Z",
    returnTo: "/diary",
  },
} satisfies Meta<typeof DeleteLogDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The confirmation, naming the title and its logged date. */
export const Default: Story = {};

/** Without a known logged date — the copy names only the title. */
export const WithoutDate: Story = { args: { loggedAt: undefined } };
