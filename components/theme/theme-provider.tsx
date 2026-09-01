"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  /** The visitor's stored preference (`light` | `dark` | `system`). */
  preference: ThemePreference;
  /** The concrete theme currently applied (`system` resolved via the OS). */
  resolvedTheme: ResolvedTheme;
  /** Persist a new preference and apply it immediately. */
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/** In-tab notification that the stored preference changed (same-document). */
const THEME_CHANGE_EVENT = "favalog:theme-change";

/*
 * Both signals are modelled as external stores read through
 * `useSyncExternalStore`. This is the hydration-safe React pattern: the server
 * snapshot (dark / light-system) is used for SSR and the first client paint —
 * matching the server-rendered `data-theme="dark"` so there is no flash or
 * hydration mismatch — and React then re-renders with the real client value.
 */

function subscribePreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function getPreferenceServerSnapshot(): ThemePreference {
  return DEFAULT_THEME;
}

function subscribeSystem(onChange: () => void): () => void {
  const query = window.matchMedia(SYSTEM_DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemSnapshot(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

function getSystemServerSnapshot(): boolean {
  return false;
}

/**
 * Client theme controller.
 *
 * The blocking `ThemeScript` applies the correct theme before paint; this
 * provider owns the *runtime* behavior — reading the stored preference,
 * tracking the OS `prefers-color-scheme` signal (for `system`), re-applying
 * `data-theme` / `color-scheme` to the root element whenever the resolved theme
 * changes, and persisting preference changes to `localStorage` (broadcasting an
 * in-tab event so the store re-reads).
 *
 * It wraps the whole app shell (a Client Component holding Server Component
 * children), which is why it is deliberately tiny.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystem,
    getSystemSnapshot,
    getSystemServerSnapshot,
  );

  const resolvedTheme = resolveTheme(preference, systemPrefersDark);

  // Keep the DOM in sync with the resolved theme. This effect only updates an
  // external system (the DOM) from React state — no setState — and is
  // idempotent with the boot script.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the dispatched event below
      // still applies the choice for this session.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/** Access the theme controller. Throws if used outside {@link ThemeProvider}. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
