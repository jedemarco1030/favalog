import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/test";

import {
  ensureFixtureAccounts,
  countMediaByExternalId,
  FIXTURE_USER,
  seedList,
  type FixtureAccount,
} from "./fixtures/admin";

/**
 * The discovery Save dialog against local Supabase and the offline provider
 * fixtures: list creation for users with existing and zero lists, refresh
 * persistence, duplicate prevention, and signed-out continuation through
 * sign-in. The TMDB trending fixture shelf supplies "Fixture Lantern Coast" to
 * Explore's discovery overview.
 *
 * Retry after a successful list creation but a failed add has no browser
 * fault-injection seam; it is covered by app/discovery/actions.test.ts and
 * components/discovery/discovery-card-actions.test.tsx.
 */

const ZERO_LISTS_USER: FixtureAccount = {
  email: "e2e-zero-lists@example.com",
  password: "Fixture-Passw0rd!23",
  username: "e2ezerolists",
  displayName: "E2E Zero Lists",
};

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

  test("saving again to the same list is reported as a duplicate, not re-added", async ({
    page,
  }) => {
    const dialog = await openSaveDialog(page);
    await dialog.getByRole("radio", { name: NEW_LIST }).check();
    await dialog.getByRole("button", { name: "Save to list" }).click();
    await expect(
      dialog.getByText(`${DISCOVERY_TITLE} is already in ${NEW_LIST}.`),
    ).toBeVisible({ timeout: 30_000 });
  });
});

async function signIn(
  page: Page,
  account: { email: string; password: string },
): Promise<void> {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe.serial("@fixtures discovery save continuation", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a signed-out Save continues to the Save dialog after sign-in", async ({
    page,
  }) => {
    await page.goto("/explore");
    const save = page.getByRole("link", {
      name: `Save ${DISCOVERY_TITLE}, sign in required`,
    });
    await expect(save.first()).toBeVisible({ timeout: 25_000 });
    await save.first().click();
    await page.waitForURL(/\/auth\/sign-in\?returnTo=/);

    await signIn(page, FIXTURE_USER);
    await page.waitForURL(/\/explore/, { timeout: 30_000 });
    await expect(
      page.getByRole("dialog", { name: `Save “${DISCOVERY_TITLE}”` }),
    ).toBeVisible({ timeout: 25_000 });
  });

  test("a user with zero lists creates a first list and saves inline", async ({
    page,
  }) => {
    await ensureFixtureAccounts([ZERO_LISTS_USER]);
    await page.goto("/auth/sign-in?returnTo=%2Fexplore");
    await signIn(page, ZERO_LISTS_USER);
    await page.waitForURL(/\/explore/, { timeout: 30_000 });

    const save = page.getByRole("button", {
      name: `Save ${DISCOVERY_TITLE} to a list`,
    });
    await expect(save.first()).toBeVisible({ timeout: 25_000 });
    await save.first().click();
    const dialog = page.getByRole("dialog", {
      name: `Save “${DISCOVERY_TITLE}”`,
    });
    await expect(
      dialog.getByText(/You don.t have any lists yet/),
    ).toBeVisible();

    const firstList = `E2E First Shelf ${RUN}`;
    await dialog.getByLabel("List name").fill(firstList);
    await dialog.getByRole("button", { name: "Create and save" }).click();
    await expect(
      dialog.getByText(`Created ${firstList} and saved ${DISCOVERY_TITLE}.`),
    ).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole("status")).toContainText(
      `Created ${firstList}`,
    );
    await dialog.getByRole("link", { name: "View list" }).click();
    await page.waitForURL(/\/list\/[^/]+$/);
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: firstList }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "List contents" }).getByRole("link", {
        name: DISCOVERY_TITLE,
        exact: true,
      }),
    ).toHaveCount(1);
    expect(await countMediaByExternalId("tmdb", "movie:999101")).toBe(1);
    await page.goto("/lists");
    await expect(
      page.getByRole("link", { name: new RegExp(firstList) }),
    ).toHaveCount(1);
  });
});
