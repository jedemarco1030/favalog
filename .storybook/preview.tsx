import type { Preview } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import "../app/globals.css";

/**
 * Global Storybook preview.
 *
 * Imports the app's `globals.css` so components render on the Favalog dark
 * design tokens (charcoal surfaces, warm off-white text) rather than an
 * unstyled white canvas. Every story is wrapped in a padded surface using the
 * same `bg-background`/`text-foreground` tokens the app shell uses.
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The dark canvas comes from `globals.css`; keep the addon from forcing a
    // conflicting white background.
    backgrounds: { disable: true },
    a11y: {
      // Surface accessibility findings in the panel without failing the build.
      test: "todo",
    },
  },
  decorators: [
    (Story): ReactNode => (
      <div className="min-h-[6rem] bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};

export default preview;
