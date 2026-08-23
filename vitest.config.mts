import { fileURLToPath } from "node:url";
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
  resolve: {
    alias: {
      // `server-only` is a build-time guard with no Vitest-resolvable module;
      // alias it to an empty stub so the server-only data layer can be
      // unit-tested with its Supabase/auth dependencies mocked.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
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
        // Pure backend utilities: env validation + DB->domain mapper. The
        // Supabase clients / session refresh / generated types are runtime
        // integration surfaces (Next.js request context, Supabase network)
        // and are intentionally NOT included here.
        "lib/supabase/env.ts",
        "lib/supabase/mappers.ts",
        "lib/supabase/log-input.ts",
        // Pure real-profile derivation + the pure log-form parsing contract.
        "lib/supabase/profile-view-model.ts",
        "app/title/[slug]/log-form.ts",
        // Pure auth helpers (framework-agnostic, deterministic). The
        // server-only DAL, URL builder, actions, and Supabase-backed selectors
        // are runtime integration surfaces and are intentionally excluded, like
        // the Supabase clients above.
        "lib/auth/safe-redirect.ts",
        "lib/auth/validation.ts",
        "lib/auth/errors.ts",
        "lib/auth/capability.ts",
        "lib/auth/profile.ts",
        // AI Discovery: the pure/deterministic search core and the server
        // search service + result mapping, all directly unit-tested (the
        // provider boundary is mocked; ranking/metrics/pipeline logic is not).
        "lib/search/config.ts",
        "lib/search/canonical-document.ts",
        "lib/search/query.ts",
        "lib/search/rrf.ts",
        "lib/search/embedding-errors.ts",
        "lib/search/embedding-provider.ts",
        "lib/search/openai-embedding-provider.ts",
        "lib/search/retry.ts",
        "lib/search/pipeline.ts",
        "lib/search/log.ts",
        "lib/search/eval/metrics.ts",
        "lib/supabase/search.ts",
        "lib/supabase/search-view-model.ts",
        // Interactive / conditional auth UI under test.
        "components/auth/auth-message.tsx",
        "components/auth/auth-field.tsx",
        "components/auth/sign-in-form.tsx",
        "components/auth/onboarding-form.tsx",
        "components/layout/signed-out-controls.tsx",
        "components/layout/account-menu.tsx",
        "components/user/profile-avatar.tsx",
        // Interactive and conditional UI under test.
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
        "components/lists/list-card.tsx",
        "components/lists/list-item-row.tsx",
        "components/lists/list-actions.tsx",
        "components/lists/lists-browser.tsx",
        "components/lists/list-view.ts",
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
