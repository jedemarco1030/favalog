import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StyledSelect } from "@/components/ui/styled-select";

const meta = {
  title: "UI/StyledSelect",
  component: StyledSelect,
  parameters: { layout: "centered" },
  args: {
    "aria-label": "Sort",
    defaultValue: "recently_added",
    children: [
      <option key="recently_added" value="recently_added">
        Recently added
      </option>,
      <option key="highest_rated" value="highest_rated">
        Highest rated
      </option>,
      <option key="newest" value="newest">
        Newest release
      </option>,
      <option key="title_asc" value="title_asc">
        Title A–Z
      </option>,
    ],
  },
} satisfies Meta<typeof StyledSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const Genre: Story = {
  args: {
    "aria-label": "Genre",
    defaultValue: "",
    children: [
      <option key="all" value="">
        All genres
      </option>,
      <option key="sf" value="Science Fiction">
        Science Fiction
      </option>,
      <option key="lit" value="Literary Fiction">
        Literary Fiction
      </option>,
      <option key="mystery" value="Mystery">
        Mystery
      </option>,
    ],
  },
};

export const LongContent: Story = {
  args: {
    "aria-label": "Genre",
    wrapperClassName: "w-48",
    defaultValue: "hist",
    children: [
      <option key="hist" value="hist">
        Historical Fiction — a very long option label
      </option>,
      <option key="sf" value="sf">
        Science Fiction
      </option>,
    ],
  },
};
