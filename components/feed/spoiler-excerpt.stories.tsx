import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SpoilerExcerpt } from "@/components/feed/spoiler-excerpt";

/**
 * Genuine spoiler concealment. A review marked `contains_spoilers` is not
 * rendered at all until the reader explicitly reveals it — italics are not
 * concealment. The control is a real button with `aria-expanded`, so it is
 * keyboard operable and announces its state.
 */
const meta = {
  title: "Feed/SpoilerExcerpt",
  component: SpoilerExcerpt,
  parameters: { layout: "centered" },
  args: {
    excerpt:
      "The finale recontextualises the whole first season, and the last shot answers the question the pilot asked.",
    mediaTitle: "Northern Lights",
    containsSpoilers: true,
  },
} satisfies Meta<typeof SpoilerExcerpt>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Spoiler-marked: concealed until the reader asks for it. */
export const Concealed: Story = {};

/** Not spoiler-marked: the excerpt reads normally, with no extra control. */
export const Plain: Story = { args: { containsSpoilers: false } };
