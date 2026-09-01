import { themeInitScript } from "@/lib/theme";

/**
 * Blocking, no-flash theme boot script.
 *
 * Rendered as the first child of `<body>` so it runs synchronously during
 * parsing — before the rest of the document paints — and applies the stored
 * theme preference to the root element. This prevents a flash of the wrong
 * theme during hydration for visitors who chose light or a light "system"
 * preference, without shipping any client framework code or a dependency.
 *
 * The root element must carry `suppressHydrationWarning` because this script
 * mutates `data-theme` / `color-scheme` before React hydrates.
 */
export function ThemeScript() {
  return (
    <script
      // The script is a constant we generate from trusted, in-repo values
      // (no user input), so injecting it as raw HTML is safe here.
      dangerouslySetInnerHTML={{ __html: themeInitScript() }}
    />
  );
}
