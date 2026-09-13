import { expect, test } from "@playwright/test";

import {
  SOCIAL_USER_A,
  SOCIAL_USER_B,
  ensureSocialFixtureUsers,
} from "./fixtures/admin";

/**
 * End-to-end multi-user integration coverage for Favalog Phase 4B.1:
 *  - Follow lifecycle (follow / unfollow / counts / idempotency)
 *  - Follower-only list visibility matrix
 *  - Access grant on follow, immediate revocation on unfollow
 *  - Route protection (direct navigation to follower-only list when not following yields 404)
 *  - Anonymous access restriction (public-only)
 *  - Owner full access preservation
 */

test.describe
  .serial("@fixtures social follow lifecycle and follower-only lists", () => {
  test("complete multi-user follow lifecycle, visibility matrix, and access revocation", async ({
    browser,
  }) => {
    // 1. Provision fresh User A and User B in local Supabase.
    await ensureSocialFixtureUsers();

    const contextA = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const anonPage = await anonContext.newPage();

    let followerListSlug = "";
    let publicListSlug = "";
    let privateListSlug = "";

    try {
      // -----------------------------------------------------------------------
      // Step 1: User A signs in and creates 3 lists (Public, Followers, Private)
      // -----------------------------------------------------------------------
      await pageA.goto("/auth/sign-in");
      await pageA.getByLabel("Email").fill(SOCIAL_USER_A.email);
      await pageA.getByLabel("Password").fill(SOCIAL_USER_A.password);
      await pageA.getByRole("button", { name: "Sign in" }).click();
      await expect(pageA).not.toHaveURL(/\/auth\/sign-in/);

      // Create Public List
      await pageA.goto("/lists");
      await pageA
        .locator("header")
        .getByRole("button", { name: "Create list" })
        .click();
      const dialogA1 = pageA.getByRole("dialog");
      await dialogA1.getByLabel("List title").fill("A Public Collection");
      await dialogA1.getByRole("radio", { name: /Public/ }).check();
      await dialogA1.getByRole("button", { name: "Create list" }).click();
      await pageA.waitForURL(/\/list\/[^/]+$/);
      publicListSlug = new URL(pageA.url()).pathname.split("/").pop() ?? "";

      // Create Followers List
      await pageA.goto("/lists");
      await pageA
        .locator("header")
        .getByRole("button", { name: "Create list" })
        .click();
      const dialogA2 = pageA.getByRole("dialog");
      await dialogA2
        .getByLabel("List title")
        .fill("A Followers Only Collection");
      await dialogA2.getByRole("radio", { name: /Followers/ }).check();
      await dialogA2.getByRole("button", { name: "Create list" }).click();
      await pageA.waitForURL(/\/list\/[^/]+$/);
      followerListSlug = new URL(pageA.url()).pathname.split("/").pop() ?? "";

      // Create Private List
      await pageA.goto("/lists");
      await pageA
        .locator("header")
        .getByRole("button", { name: "Create list" })
        .click();
      const dialogA3 = pageA.getByRole("dialog");
      await dialogA3
        .getByLabel("List title")
        .fill("A Secret Private Collection");
      await dialogA3.getByRole("radio", { name: /Private/ }).check();
      await dialogA3.getByRole("button", { name: "Create list" }).click();
      await pageA.waitForURL(/\/list\/[^/]+$/);
      privateListSlug = new URL(pageA.url()).pathname.split("/").pop() ?? "";

      expect(publicListSlug).not.toBe("");
      expect(followerListSlug).not.toBe("");
      expect(privateListSlug).not.toBe("");

      // User A on their own profile sees all 3 lists and no follow button
      await pageA.goto(`/profile/${SOCIAL_USER_A.username}`);
      await expect(
        pageA.getByRole("heading", { level: 3, name: "A Public Collection" }),
      ).toBeVisible();
      await expect(
        pageA.getByRole("heading", {
          level: 3,
          name: "A Followers Only Collection",
        }),
      ).toBeVisible();
      await expect(
        pageA.getByRole("heading", {
          level: 3,
          name: "A Secret Private Collection",
        }),
      ).toBeVisible();
      await expect(pageA.getByRole("button", { name: /follow/i })).toHaveCount(
        0,
      );

      // -----------------------------------------------------------------------
      // Step 2: User B signs in, discovers User A via Community lists, and opens profile
      // -----------------------------------------------------------------------
      await pageB.goto("/auth/sign-in");
      await pageB.getByLabel("Email").fill(SOCIAL_USER_B.email);
      await pageB.getByLabel("Password").fill(SOCIAL_USER_B.password);
      await pageB.getByRole("button", { name: "Sign in" }).click();
      await expect(pageB).not.toHaveURL(/\/auth\/sign-in/);

      // Start discovery from Community lists (not a manually entered profile URL)
      await pageB.goto("/lists");
      const communitySection = pageB.locator("section", {
        has: pageB.getByRole("heading", { level: 2, name: "Community lists" }),
      });
      await expect(communitySection).toBeVisible();

      // Find User A's public list card in Community lists
      const listCard = communitySection.locator("article", {
        has: pageB.getByRole("heading", {
          level: 3,
          name: "A Public Collection",
        }),
      });
      await expect(listCard).toBeVisible();

      // Click User A's creator attribution link on the list card
      const creatorLink = listCard.getByRole("link", {
        name: SOCIAL_USER_A.displayName,
      });
      await expect(creatorLink).toHaveAttribute(
        "href",
        `/profile/${SOCIAL_USER_A.username}`,
      );
      await creatorLink.click();

      // User A's real profile opens
      await pageB.waitForURL(`/profile/${SOCIAL_USER_A.username}`);
      await expect(pageB).toHaveURL(`/profile/${SOCIAL_USER_A.username}`);

      // B sees 0 followers, 0 following
      await expect(pageB.getByText("0 followers")).toBeVisible();
      await expect(pageB.getByText("0 following")).toBeVisible();

      // B sees Follow button in unpressed state
      const followBtn = pageB.getByRole("button", {
        name: `Follow ${SOCIAL_USER_A.displayName}`,
      });
      await expect(followBtn).toBeVisible();
      await expect(followBtn).toHaveAttribute("aria-pressed", "false");

      // B sees only A's public list (not followers or private)
      await expect(
        pageB.getByRole("heading", { level: 3, name: "A Public Collection" }),
      ).toBeVisible();
      await expect(
        pageB.getByRole("heading", {
          level: 3,
          name: "A Followers Only Collection",
        }),
      ).toHaveCount(0);
      await expect(
        pageB.getByRole("heading", {
          level: 3,
          name: "A Secret Private Collection",
        }),
      ).toHaveCount(0);

      // Direct navigation to follower-only list fails (404)
      const resFollowerBefore = await pageB.goto(`/list/${followerListSlug}`);
      expect(resFollowerBefore?.status()).toBe(404);
      await expect(
        pageB.getByRole("heading", { name: /couldn.?t find that page/i }),
      ).toBeVisible();

      // Direct navigation to private list fails (404)
      const resPrivate = await pageB.goto(`/list/${privateListSlug}`);
      expect(resPrivate?.status()).toBe(404);

      // -----------------------------------------------------------------------
      // Step 3 & 4: User B follows User A
      // -----------------------------------------------------------------------
      await pageB.goto(`/profile/${SOCIAL_USER_A.username}`);
      await followBtn.click();

      // Button flips to Following state
      const followingBtn = pageB.getByRole("button", {
        name: `Unfollow ${SOCIAL_USER_A.displayName}`,
      });
      await expect(followingBtn).toBeVisible();
      await expect(followingBtn).toHaveAttribute("aria-pressed", "true");

      // Follower count updates to 1 follower
      await expect(pageB.getByText("1 follower")).toBeVisible();

      // Refresh to prove persisted Following state
      await pageB.reload();
      await expect(
        pageB.getByRole("button", {
          name: `Unfollow ${SOCIAL_USER_A.displayName}`,
        }),
      ).toBeVisible();
      await expect(pageB.getByText("1 follower")).toBeVisible();

      // A's Followers list now appears!
      await expect(
        pageB.getByRole("heading", {
          level: 3,
          name: "A Followers Only Collection",
        }),
      ).toBeVisible();
      // Private list is still strictly hidden
      await expect(
        pageB.getByRole("heading", {
          level: 3,
          name: "A Secret Private Collection",
        }),
      ).toHaveCount(0);

      // -----------------------------------------------------------------------
      // Step 5: B opens A's follower list detail page & reloads
      // -----------------------------------------------------------------------
      await pageB.goto(`/list/${followerListSlug}`);
      await expect(
        pageB.getByRole("heading", {
          level: 1,
          name: "A Followers Only Collection",
        }),
      ).toBeVisible();

      // B sees creator attribution linking to User A's profile on detail page
      const detailCreatorLink = pageB.getByRole("link", {
        name: new RegExp(`a list by ${SOCIAL_USER_A.displayName}`, "i"),
      });
      await expect(detailCreatorLink).toBeVisible();
      await expect(detailCreatorLink).toHaveAttribute(
        "href",
        `/profile/${SOCIAL_USER_A.username}`,
      );

      // Reload preserves access
      await pageB.reload();
      await expect(
        pageB.getByRole("heading", {
          level: 1,
          name: "A Followers Only Collection",
        }),
      ).toBeVisible();

      // -----------------------------------------------------------------------
      // Step 6: User B unfollows User A
      // -----------------------------------------------------------------------
      await pageB.goto(`/profile/${SOCIAL_USER_A.username}`);
      await expect(followingBtn).toBeVisible();
      await followingBtn.click();

      // Button flips back to Follow
      await expect(followBtn).toBeVisible();
      await expect(followBtn).toHaveAttribute("aria-pressed", "false");

      // Follower count drops back to 0
      await expect(pageB.getByText("0 followers")).toBeVisible();

      // Followers list is immediately gone from the profile view
      await expect(
        pageB.getByRole("heading", {
          level: 3,
          name: "A Followers Only Collection",
        }),
      ).toHaveCount(0);

      // -----------------------------------------------------------------------
      // Step 7: Direct navigation after unfollow yields 404
      // -----------------------------------------------------------------------
      const resFollowerAfter = await pageB.goto(`/list/${followerListSlug}`);
      expect(resFollowerAfter?.status()).toBe(404);
      await expect(
        pageB.getByRole("heading", { name: /couldn.?t find that page/i }),
      ).toBeVisible();

      // -----------------------------------------------------------------------
      // Step 8: Anonymous visitor check
      // -----------------------------------------------------------------------
      await anonPage.goto(`/profile/${SOCIAL_USER_A.username}`);
      await expect(anonPage.getByText("0 followers")).toBeVisible();
      const anonFollowLink = anonPage.getByRole("link", { name: "Follow" });
      await expect(anonFollowLink).toBeVisible();
      await expect(anonFollowLink).toHaveAttribute(
        "href",
        `/auth/sign-in?returnTo=%2Fprofile%2F${SOCIAL_USER_A.username}`,
      );

      // Anonymous sees only public list
      await expect(
        anonPage.getByRole("heading", {
          level: 3,
          name: "A Public Collection",
        }),
      ).toBeVisible();
      await expect(
        anonPage.getByRole("heading", {
          level: 3,
          name: "A Followers Only Collection",
        }),
      ).toHaveCount(0);

      const anonResFollower = await anonPage.goto(`/list/${followerListSlug}`);
      expect(anonResFollower?.status()).toBe(404);

      const anonResPublic = await anonPage.goto(`/list/${publicListSlug}`);
      expect(anonResPublic?.status()).toBe(200);
      await expect(
        anonPage.getByRole("heading", {
          level: 1,
          name: "A Public Collection",
        }),
      ).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
      await anonContext.close();
    }
  });
});
