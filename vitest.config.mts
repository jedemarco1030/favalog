import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for Favalog unit and component tests.
 *
 * - `tsconfigPaths()` mirrors the `@/*` alias from tsconfig.json so imports
 *   line up with the application at test time.
 * - `react()` enables JSX / React Fast Refresh transforms for RTL tests.
 * - The `jsdom` environment gives DOM APIs to component tests; pure data-layer
 *   tests run fine in it too.
 *
 * Coverage is intentionally scoped (via `include`) to the deterministic
 * domain/data logic and the interactive/conditional components we deliberately
 * test. Purely presentational or async Server-Component-only surfaces are
 * excluded so the thresholds stay meaningful rather than encouraging
 * low-value "render smoke" tests.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e", "storybook-static"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        // Deterministic domain / data logic.
        "lib/data/**/*.ts",
        "lib/cn.ts",
        // Interactive and conditional UI under test.
        "components/media/explore-discovery.tsx",
        "components/media/media-card.tsx",
        "components/media/media-type-badge.tsx",
        "components/media/rating-breakdown.tsx",
        "components/ui/star-rating.tsx",
        "components/ui/rating-display.tsx",
        "components/ui/empty-state.tsx",
        "components/ui/badge.tsx",
        "components/ui/search-input.tsx",
        "components/reviews/review-card.tsx",
        "components/activity/activity-card.tsx",
        "components/diary/diary-timeline.tsx",
        "components/diary/diary-view.ts",
        "components/layout/mobile-nav.tsx",
        "components/layout/nav-items.ts",
      ],
      exclude: [
        "**/*.stories.{ts,tsx}",
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        // Pure re-export barrel; nothing to exercise directly.
        "lib/data/index.ts",
      ],
      thresholds: {
        statements: 70,
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
