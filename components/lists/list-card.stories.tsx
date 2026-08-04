import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ListCard } from "@/components/lists/list-card";
import { toListCardView } from "@/components/lists/to-list-card-view";
import type { ListCardView } from "@/components/lists/list-view";
import { getListBySlug } from "@/lib/data";

function viewFor(slug: string): ListCardView {
  const list = getListBySlug(slug);
  if (!list) throw new Error(`Unknown list slug in story: ${slug}`);
  const view = toListCardView(list);
  if (!view) throw new Error(`Could not build view for list: ${slug}`);
  return view;
}

const mixed = viewFor("favorite-sci-fi");
const movieOnly = viewFor("movies-everyone-should-see-once");
const bookOnly = viewFor("books-im-reading-in-2026");
const singleItem = viewFor("the-one-i-rewatch-most");
const longerList = viewFor("series-worth-the-binge");

const longTitle: ListCardView = {
  ...mixed,
  id: "l_longtitle",
  slug: "an-extremely-long-list-title",
  title:
    "An Extraordinarily and Deliberately Overlong Collection Title That Tests How the Card Wraps",
};

const meta = {
  title: "Lists/ListCard",
  component: ListCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedMedia: Story = { args: { list: mixed } };
export const MovieOnly: Story = { args: { list: movieOnly } };
export const BookOnly: Story = { args: { list: bookOnly } };
export const SingleItem: Story = { args: { list: singleItem } };
export const LongerList: Story = { args: { list: longerList } };
export const LongTitle: Story = { args: { list: longTitle } };
