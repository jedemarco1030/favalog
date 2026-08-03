import type { StorybookConfig } from "@storybook/nextjs-vite";

/**
 * Storybook configuration for Favalog.
 *
 * Uses the Next.js + Vite framework so stories share the app's `next/image`,
 * `next/link`, path aliases (`@/*`), and Tailwind v4 pipeline. Static assets
 * (posters, avatars) are served from `public/` so `next/image` resolves them.
 */
const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
};

export default config;
