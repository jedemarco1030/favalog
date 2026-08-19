import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RealListCard } from "@/components/lists/real-list-card";
import type {
  ListOwnerView,
  ListSummaryView,
} from "@/lib/supabase/list-view-model";

/**
 * A card for a real (persistent) list, built from a serializable
 * {@link ListSummaryView}. Unlike the mock `ListCard`, it shows only what is
 * actually stored — no fabricated covers, like count, or curator notes. These
 * stories contrast public vs private presentation and the community (owner)
 * variant.
 */
const baseList: ListSummaryView = {
  id: "l1",
  slug: "favorite-sci-fi",
  title: "Favorite Sci-Fi",
  description: "A running shelf of the sci-fi that stuck with me.",
  visibility: "public",
  isRanked: false,
  itemCount: 12,
  updatedAt: "2026-08-19T15:31:00.000Z",
};

const owner: ListOwnerView = {
  username: "jamie",
  displayName: "Jamie Rivera",
  avatarUrl: null,
};

const meta = {
  title: "Lists/RealListCard",
  component: RealListCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: { list: baseList },
} satisfies Meta<typeof RealListCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A public list on an owner surface — the status reads "Public". */
export const Public: Story = { args: { showVisibility: true } };

/** A private list on an owner surface — clearly flagged "Private". */
export const Private: Story = {
  args: {
    list: {
      ...baseList,
      slug: "private-picks",
      title: "Private Picks",
      visibility: "private",
    },
    showVisibility: true,
  },
};

/** A ranked list — the order is a deliberate ranking. */
export const Ranked: Story = {
  args: {
    list: {
      ...baseList,
      slug: "top-ten-thrillers",
      title: "Top Ten Thrillers",
      isRanked: true,
    },
    showVisibility: true,
  },
};

/** A community card that surfaces the list's real owner identity. */
export const WithOwner: Story = { args: { owner } };
