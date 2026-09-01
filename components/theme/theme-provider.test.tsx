import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Controllable `matchMedia` stub: lets a test set whether the OS prefers dark
 * and fire a live change to registered listeners.
 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;

  window.matchMedia = ((query: string) =>
    ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) =>
        listeners.add(cb),
      removeEventListener: (
        _: string,
        cb: (event: MediaQueryListEvent) => void,
      ) => listeners.delete(cb),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;

  return {
    setMatches(next: boolean) {
      matches = next;
      act(() => {
        for (const cb of listeners) {
          cb({ matches: next } as MediaQueryListEvent);
        }
      });
    },
  };
}

function Probe() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button type="button" onClick={() => setPreference("light")}>
        light
      </button>
      <button type="button" onClick={() => setPreference("dark")}>
        dark
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        system
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to dark and applies it to the document when nothing is stored", () => {
    installMatchMedia(false);
    renderProbe();

    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("adopts a stored preference on mount", () => {
    installMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    renderProbe();

    expect(screen.getByTestId("preference")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores an invalid stored value and keeps the dark default", () => {
    installMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "banana");
    renderProbe();

    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
  });

  it("persists and applies a new preference when changed", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "light" }));

    expect(screen.getByTestId("preference")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("resolves the system preference from the OS signal", async () => {
    installMatchMedia(true); // OS prefers dark
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "system" }));

    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("reacts to a live OS change while following the system preference", async () => {
    const media = installMatchMedia(false); // OS starts light
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "system" }));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");

    media.setMatches(true); // OS switches to dark
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
