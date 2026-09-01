/**
 * Favalog theme model.
 *
 * The visual system is dark-first (dark is the brand's initial reference), but
 * visitors may opt into a light theme or follow their operating-system
 * preference. This module holds the framework-agnostic, deterministic pieces of
 * that system so they can be unit-tested and shared between the client
 * `ThemeProvider` and the blocking no-flash boot script:
 *
 * - the storage key and the allowed preference values,
 * - the default preference (dark, so first-time and dark visitors never flash),
 * - a pure resolver from a preference + system signal to a concrete theme, and
 * - the exact inline script string injected before paint.
 */

/** A visitor's stored theme *preference*. `system` follows the OS setting. */
export const THEME_OPTIONS = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number];

/** A concrete, applied theme — what actually paints. `system` resolves to one. */
export type ResolvedTheme = "light" | "dark";

/** localStorage key holding the visitor's {@link ThemePreference}. */
export const THEME_STORAGE_KEY = "favalog-theme";

/**
 * Default preference when nothing is stored. Dark keeps Favalog's initial
 * visual reference intact and means the server-rendered `data-theme="dark"`
 * matches the boot script for first-time and dark visitors (no flash).
 */
export const DEFAULT_THEME: ThemePreference = "dark";

/** Narrow an untrusted value (e.g. from storage) to a {@link ThemePreference}. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_OPTIONS as readonly string[]).includes(value)
  );
}

/**
 * Resolve a stored preference plus the current system signal into the concrete
 * theme that should paint. Pure and total: `system` follows `systemPrefersDark`,
 * explicit preferences are returned as-is.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

/**
 * The inline script injected at the top of the document. It runs synchronously
 * before first paint to set `data-theme` and `color-scheme` on the root
 * element from the stored preference, so the correct theme is applied without a
 * flash of the wrong one during hydration. It is intentionally tiny, dependency
 * free, and wrapped in try/catch so a blocked/absent `localStorage` (e.g.
 * private mode) silently falls back to the default preference.
 */
export function themeInitScript(): string {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const fallback = JSON.stringify(DEFAULT_THEME);
  return `(function(){try{var k=${key};var s=localStorage.getItem(k);var p=(s==="light"||s==="dark"||s==="system")?s:${fallback};var d=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var r=p==="system"?(d?"dark":"light"):p;var e=document.documentElement;e.dataset.theme=r;e.style.colorScheme=r;}catch(_){}})();`;
}
