import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("labels the trigger with the current preference and starts collapsed", () => {
    renderToggle();
    const trigger = screen.getByRole("button", { name: "Theme: Dark" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a menu exposing the three preferences with the current one checked", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));

    const menu = screen.getByRole("menu", { name: "Theme" });
    expect(menu).toBeInTheDocument();

    const light = screen.getByRole("menuitemradio", { name: "Light" });
    const dark = screen.getByRole("menuitemradio", { name: "Dark" });
    const system = screen.getByRole("menuitemradio", { name: "System" });

    expect(light).toHaveAttribute("aria-checked", "false");
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(system).toHaveAttribute("aria-checked", "false");
  });

  it("selects a preference, applies it, persists it, and closes the menu", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // Trigger label now reflects the new preference.
    expect(
      screen.getByRole("button", { name: "Theme: Light" }),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("closes the menu on Escape without changing the preference", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Theme: Dark" }),
    ).toBeInTheDocument();
  });
});
