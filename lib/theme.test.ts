import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  isThemePreference,
  resolveTheme,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "@/lib/theme";

describe("theme model", () => {
  it("exposes exactly the three preferences and a dark default", () => {
    expect(THEME_OPTIONS).toEqual(["light", "dark", "system"]);
    expect(DEFAULT_THEME).toBe("dark");
  });

  describe("isThemePreference", () => {
    it("accepts the known preferences", () => {
      for (const option of THEME_OPTIONS) {
        expect(isThemePreference(option)).toBe(true);
      }
    });

    it("rejects unknown or non-string values", () => {
      expect(isThemePreference("blue")).toBe(false);
      expect(isThemePreference("")).toBe(false);
      expect(isThemePreference(null)).toBe(false);
      expect(isThemePreference(undefined)).toBe(false);
      expect(isThemePreference(1)).toBe(false);
      expect(isThemePreference({})).toBe(false);
    });
  });

  describe("resolveTheme", () => {
    it("returns explicit preferences unchanged, ignoring the system signal", () => {
      expect(resolveTheme("light", true)).toBe("light");
      expect(resolveTheme("light", false)).toBe("light");
      expect(resolveTheme("dark", true)).toBe("dark");
      expect(resolveTheme("dark", false)).toBe("dark");
    });

    it("follows the OS signal for the system preference", () => {
      expect(resolveTheme("system", true)).toBe("dark");
      expect(resolveTheme("system", false)).toBe("light");
    });
  });

  describe("themeInitScript", () => {
    const script = themeInitScript();

    it("references the storage key and the default preference", () => {
      expect(script).toContain(JSON.stringify(THEME_STORAGE_KEY));
      expect(script).toContain(JSON.stringify(DEFAULT_THEME));
    });

    it("is wrapped in a try/catch IIFE so a blocked storage never throws", () => {
      expect(script.startsWith("(function()")).toBe(true);
      expect(script).toContain("try{");
      expect(script).toContain("catch");
    });

    it("applies the resolved theme to the document element before paint", () => {
      expect(script).toContain("document.documentElement");
      expect(script).toContain("dataset.theme");
      expect(script).toContain("colorScheme");
      expect(script).toContain("prefers-color-scheme: dark");
    });

    it("evaluates to a stored 'light' preference without touching the DOM in this test", () => {
      // Execute the script body against a controlled fake environment to prove
      // it resolves and applies the stored preference deterministically.
      const root = {
        dataset: {} as Record<string, string>,
        style: {} as { colorScheme?: string },
      };
      const fakeWindow = {
        matchMedia: () => ({ matches: true }),
      };
      const fakeLocalStorage = {
        getItem: (key: string) => (key === THEME_STORAGE_KEY ? "light" : null),
      };
      const run = new Function(
        "window",
        "localStorage",
        "document",
        `${script}`,
      );
      run(fakeWindow, fakeLocalStorage, { documentElement: root });

      // Stored "light" must win over a dark system signal.
      expect(root.dataset.theme).toBe("light");
      expect(root.style.colorScheme).toBe("light");
    });

    it("falls back to the dark default when nothing is stored", () => {
      const root = {
        dataset: {} as Record<string, string>,
        style: {} as { colorScheme?: string },
      };
      const fakeWindow = { matchMedia: () => ({ matches: false }) };
      const fakeLocalStorage = { getItem: () => null };
      const run = new Function(
        "window",
        "localStorage",
        "document",
        `${script}`,
      );
      run(fakeWindow, fakeLocalStorage, { documentElement: root });

      expect(root.dataset.theme).toBe("dark");
      expect(root.style.colorScheme).toBe("dark");
    });

    it("resolves the system preference against the OS signal", () => {
      const root = {
        dataset: {} as Record<string, string>,
        style: {} as { colorScheme?: string },
      };
      const fakeWindow = { matchMedia: () => ({ matches: false }) };
      const fakeLocalStorage = { getItem: () => "system" };
      const run = new Function(
        "window",
        "localStorage",
        "document",
        `${script}`,
      );
      run(fakeWindow, fakeLocalStorage, { documentElement: root });

      expect(root.dataset.theme).toBe("light");
      expect(root.style.colorScheme).toBe("light");
    });
  });
});
