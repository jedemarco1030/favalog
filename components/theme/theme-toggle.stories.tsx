import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * The header's theme control. It reads and writes the visitor's theme
 * preference through `ThemeProvider`, so the story wraps it in one. Open the
 * menu (click the trigger) to switch between Light, Dark, and System — the
 * choice persists to `localStorage` and re-themes the whole preview.
 */
const meta = {
  title: "Theme/ThemeToggle",
  component: ThemeToggle,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: dark preference. Click the trigger to open the preference menu. */
export const Default: Story = {};
