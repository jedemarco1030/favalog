import { expect, test } from "@playwright/test";

import { FIXTURE_USER, seedList } from "./fixtures/admin";

/**
 * The discovery Save dialog's "Create new list" flow for a user who already
 * has lists, against local Supabase and the offline provider fixtures. The
 * TMDB trending fixture shelf supplies "Fixture Lantern Coast" to Explore's
 * discovery overview. The zero-lists variant is covered by the component tests
 * (the shared fixture user always has lists by the time this runs).
 */

const DISCOVERY_TITLE = "Fixture Lantern Coast";
const RUN = Date.now().toString(36);
const EXISTING_LIST = `E2E Existing Shelf ${RUN}`;
const NEW_LIST = `E2E Created Shelf ${RUN}`;

test.describe.serial("@fixtures discovery save dialog", () => {
  test.beforeAll(async () => {
    await seedList(FIXTURE_USER.email, {
      slug: `e2e-existing-shelf-${RUN}`,
      title: EXISTING_LIST,
      visibility: "private",
    });
  });

  async function openSaveDialog(page: import("@playwright/test").Page) {
    await page.goto("/explore");
    const save = page.getByRole("button", {
      name: `Save ${DISCOVERY_TITLE} to a list`,
    });
    await expect(save.first()).toBeVisible({ timeout: 25_000 });
    await save.first().click();
    const dialog = page.getByRole("dialog", {
      name: `Save “${DISCOVERY_TITLE}”`,
    });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("cancel returns to the existing list picker", async ({ page }) => {
    const dialog = await openSaveDialog(page);
    await expect(
      dialog.getByRole("radio", { name: EXISTING_LIST }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Create new list" }).click();
    await expect(dialog.getByLabel("List name")).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(
      dialog.getByRole("radio", { name: EXISTING_LIST }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Create new list" }),
    ).toBeFocused();
  });

  test("create and save persists the title in the new list after refresh", async ({
    page,
  }) => {
    const dialog = await openSaveDialog(page);

    await dialog.getByRole("button", { name: "Create new list" }).click();
    await dialog.getByLabel("List name").fill(NEW_LIST);
    await dialog.getByRole("radio", { name: /Private/ }).check();
    await dialog.getByRole("button", { name: "Create and save" }).click();

    await expect(
      dialog.getByText(`Created ${NEW_LIST} and saved ${DISCOVERY_TITLE}.`),
    ).toBeVisible({ timeout: 30_000 });

    await dialog.getByRole("link", { name: "View list" }).click();
    await page.waitForURL(/\/list\/[^/]+$/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: NEW_LIST }),
    ).toBeVisible();
    await expect(page.getByText(DISCOVERY_TITLE).first()).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: NEW_LIST }),
    ).toBeVisible();
    await expect(page.getByText(DISCOVERY_TITLE).first()).toBeVisible();
  });
});
