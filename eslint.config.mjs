import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turn off ESLint rules that conflict with Prettier's formatting. Keep this
  // last so it wins over any formatting rules enabled above. ESLint remains
  // the code-quality tool; Prettier owns formatting.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test / tooling artifacts.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "storybook-static/**",
  ]),
]);

export default eslintConfig;
