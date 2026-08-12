import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogDialog } from "@/components/media/log-dialog";
import type { LogFormState } from "@/app/title/[slug]/log-form";

/**
 * The shared, accessible logging dialog used by Log / Rate / Review (create)
 * and by the owner's edit controls (edit, pre-filled). It is presentational:
 * its Server Action is injected as a prop, so these stories drive it with a
 * no-op action and never import a server-only module.
 */
const noopAction = async (): Promise<LogFormState> => ({ status: "idle" });

const movie = {
  kind: "movie" as const,
  slug: "dune-part-two",
  title: "Dune: Part Two",
};

const meta = {
  title: "Media/LogDialog",
  component: LogDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    focus: "log",
    item: movie,
    returnTo: "/title/dune-part-two",
    defaultRevisit: false,
    action: noopAction,
  },
} satisfies Meta<typeof LogDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Logging a new entry — the create flow opened from the title actions. */
export const Create: Story = {};

/** Rate entry point — the same dialog with the rating field emphasised. */
export const RateFocus: Story = { args: { focus: "rate" } };

/** Editing an existing entry, pre-filled with its stored values. */
export const Edit: Story = {
  args: {
    mode: "edit",
    focus: "log",
    diaryEntryId: "11111111-1111-1111-1111-111111111111",
    defaultRevisit: true,
    initialValues: {
      loggedAt: "2026-08-02T21:30:00.000Z",
      rating: 4,
      isRevisit: true,
      reviewTitle: "A quiet triumph",
      reviewBody:
        "Second time through and it holds up — the sound design still floors me.",
      containsSpoilers: false,
    },
  },
};
