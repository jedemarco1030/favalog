import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreateListForm } from "@/components/lists/create-list-form";
import type { CreateListFormState } from "@/app/lists/list-form";

/**
 * The reusable, accessible create-list form. It is presentational: the
 * create-list Server Action is injected as a prop, so these stories drive it
 * with mock actions returning serializable {@link CreateListFormState} results
 * and never import a server-only module.
 */
const idleAction = async (): Promise<CreateListFormState> => ({
  status: "idle",
});

const meta = {
  title: "Lists/CreateListForm",
  component: CreateListForm,
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
    returnTo: "/lists",
  },
} satisfies Meta<typeof CreateListForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The empty form, ready for a new list (Public selected by default). */
export const Default: Story = {};

/** A never-resolving action so the submit shows its pending treatment. */
export const Pending: Story = {
  args: {
    action: () => new Promise<CreateListFormState>(() => {}),
  },
};

/** A form-level error banner without leaking a raw database detail. */
export const Error: Story = {
  args: {
    action: async (): Promise<CreateListFormState> => ({
      status: "error",
      message: "We couldn't create that list just now. Please try again.",
    }),
  },
};

/** Field-level validation surfaced from an `invalid` result. */
export const Invalid: Story = {
  args: {
    action: async (): Promise<CreateListFormState> => ({
      status: "invalid",
      message: "Please fix the highlighted fields.",
      fieldErrors: { title: "Give your list a title." },
    }),
  },
};

/** A successful create — the parent's `onCreated` would take over from here. */
export const Success: Story = {
  args: {
    action: async (): Promise<CreateListFormState> => ({
      status: "success",
      listId: "11111111-1111-1111-1111-111111111111",
      slug: "favorite-sci-fi",
      title: "Favorite Sci-Fi",
      visibility: "public",
      isRanked: false,
    }),
  },
};
