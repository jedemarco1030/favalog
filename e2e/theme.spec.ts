import { expect, test } from "@playwright/test";

/**
 * Theme system, in a real browser. Tagged `@no-env` because theming is entirely
 * client-side and needs no Supabase — it runs against the no-environment build
 * where the homepage still renders. Covers: the dark default, switching via the
 * accessible header control, persistence across a reload without a flash of the
 * wrong theme, and keyboard operability.
 */
test.describe("Theme @no-env", () => {
  test("defaults to dark and exposes an accessible theme control", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const trigger = page
      .getByRole("banner")
      .getByRole("button", { name: /^Theme:/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-label", "Theme: Dark");
  });

  test("switches to light and persists across a reload without a flash", async ({
    page,
  }) => {
    await page.goto("/");

    const trigger = page
      .getByRole("banner")
      .getByRole("button", { name: /^Theme:/ });
    await trigger.click();

    const menu = page.getByRole("menu", { name: "Theme" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitemradio", { name: "Light" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(menu).toBeHidden();

    // Reload: the blocking boot script must apply the stored preference before
    // paint, so the very first observable root state is already light.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      page.getByRole("banner").getByRole("button", { name: /^Theme:/ }),
    ).toHaveAttribute("aria-label", "Theme: Light");
  });

  test("is operable by keyboard", async ({ page }) => {
    await page.goto("/");

    const trigger = page
      .getByRole("banner")
      .getByRole("button", { name: /^Theme:/ });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu", { name: "Theme" });
    await expect(menu).toBeVisible();

    // Escape closes the menu and restores focus to the trigger.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
