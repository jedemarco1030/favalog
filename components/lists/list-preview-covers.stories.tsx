import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ListPreviewCovers } from "@/components/lists/list-preview-covers";
import type { ListPreviewCover } from "@/components/lists/list-view";
import { getListBySlug, getListMedia } from "@/lib/data";

function coversFor(slug: string): ListPreviewCover[] {
  const list = getListBySlug(slug);
  if (!list) throw new Error(`Unknown list slug in story: ${slug}`);
  return getListMedia(list).map((item) => ({
    id: item.id,
    title: item.title,
    posterUrl: item.posterUrl,
  }));
}

const many = coversFor("favorite-sci-fi");

const meta = {
  title: "Lists/ListPreviewCovers",
  component: ListPreviewCovers,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListPreviewCovers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveCovers: Story = { args: { covers: many } };
export const ThreeCovers: Story = { args: { covers: many.slice(0, 3) } };
export const SingleCover: Story = { args: { covers: many.slice(0, 1) } };
export const Empty: Story = { args: { covers: [] } };
