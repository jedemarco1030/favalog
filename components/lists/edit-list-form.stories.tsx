import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EditListForm } from "@/components/lists/edit-list-form";
import type { EditListFormState } from "@/app/lists/list-form";

/**
 * The reusable, accessible edit-list form, pre-filled with a list's current
 * metadata. It is presentational: the edit-list Server Action is injected as a
 * prop, so these stories drive it with mock actions returning serializable
 * {@link EditListFormState} results and never import a server-only module.
 */
const idleAction = async (): Promise<EditListFormState> => ({
  status: "idle",
});

const meta = {
  title: "Lists/EditListForm",
  component: EditListForm,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    action: idleAction,
    returnTo: "/list/favorite-sci-fi",
    initial: {
      listId: "11111111-1111-1111-1111-111111111111",
      title: "Favorite Sci-Fi",
      description: "A tight canon of favorites.",
      isRanked: true,
      visibility: "private",
    },
  },
} satisfies Meta<typeof EditListForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form pre-filled with a ranked, private list's current metadata. */
export const Default: Story = {};

/** A public list with no description, ready to edit. */
export const PublicNoDescription: Story = {
  args: {
    initial: {
      listId: "22222222-2222-2222-2222-222222222222",
      title: "Weekend Watchlist",
      description: null,
      isRanked: false,
      visibility: "public",
    },
  },
};

/** A never-resolving action so the submit shows its pending treatment. */
export const Pending: Story = {
  args: {
    action: () => new Promise<EditListFormState>(() => {}),
  },
};

/** A form-level error banner without leaking a raw database detail. */
export const Error: Story = {
  args: {
    action: async (): Promise<EditListFormState> => ({
      status: "error",
      message: "We couldn't save your changes just now. Please try again.",
    }),
  },
};

/** Field-level validation surfaced from an `invalid` result. */
export const Invalid: Story = {
  args: {
    action: async (): Promise<EditListFormState> => ({
      status: "invalid",
      message: "Please fix the highlighted fields.",
      fieldErrors: { title: "Give your list a title." },
    }),
  },
};
