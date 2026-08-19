import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import type {
  CreateListFormState,
  ListItemFormState,
} from "@/app/lists/list-form";
import type { ListMembershipView } from "@/lib/supabase/list-view-model";

/**
 * The accessible "Add to list" dialog for a signed-in, onboarded viewer. It is
 * presentational: the add / remove / create Server Actions are injected, so
 * these stories drive them with mock functions returning resolved success
 * states and never import a server-only module. `open` is forced so the dialog
 * renders in the frame.
 */
const media = { slug: "afterglow", title: "Afterglow" };

const addAction = async (): Promise<ListItemFormState> => ({
  status: "success",
  action: "added",
  slug: "favorite-sci-fi",
  listId: "l1",
});

const removeAction = async (): Promise<ListItemFormState> => ({
  status: "success",
  action: "removed",
  slug: "favorite-sci-fi",
  listId: "l1",
});

const createAction = async (): Promise<CreateListFormState> => ({
  status: "success",
  listId: "new-list",
  slug: "new-list",
  title: "New list",
  visibility: "public",
  isRanked: false,
  addedMediaSlug: media.slug,
});

const ownedLists: ListMembershipView[] = [
  {
    id: "l1",
    slug: "favorite-sci-fi",
    title: "Favorite Sci-Fi",
    description: null,
    visibility: "public",
    isRanked: false,
    itemCount: 12,
    updatedAt: "2026-08-19T15:31:00.000Z",
    containsMedia: false,
  },
  {
    id: "l2",
    slug: "rewatch-forever",
    title: "Rewatch Forever",
    description: null,
    visibility: "private",
    isRanked: true,
    itemCount: 5,
    updatedAt: "2026-08-10T09:00:00.000Z",
    containsMedia: true,
  },
  {
    id: "l3",
    slug: "weekend-picks",
    title: "Weekend Picks",
    description: null,
    visibility: "public",
    isRanked: false,
    itemCount: 3,
    updatedAt: "2026-07-30T18:20:00.000Z",
    containsMedia: false,
  },
];

const meta = {
  title: "Lists/AddToListDialog",
  component: AddToListDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    media,
    returnTo: "/title/afterglow",
    lists: ownedLists,
    mediaKnown: true,
    addAction,
    removeAction,
    createAction,
  },
} satisfies Meta<typeof AddToListDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owned lists with mixed membership, visibility (public/private), and ranking. */
export const WithOwnedLists: Story = {};

/** No lists yet — the dialog opens straight into the inline create form. */
export const EmptyState: Story = { args: { lists: [] } };

/** The catalog title isn't known to the store — a controlled unavailable state. */
export const Unavailable: Story = { args: { mediaKnown: false } };

/** The viewer's lists couldn't be read — a controlled read-error state. */
export const ReadError: Story = {
  args: {
    error: "We couldn't load your lists just now. Please try again.",
  },
};
