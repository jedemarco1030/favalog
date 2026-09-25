import { expect, test, type Page } from "@playwright/test";

import {
  SOCIAL_USER_A,
  SOCIAL_USER_B,
  ensureSocialFixtureUsers,
  seedList,
  seedStandaloneReviews,
} from "./fixtures/admin";

/**
 * End-to-end multi-user coverage for review + list likes.
 *
 * The mandated journey, on seeded LOCAL Supabase:
 *
 *  1. A (the author) has one real standalone review and two lists — one public,
 *     one followers-only — seeded through the loopback-guarded service-role
 *     helper. B (the viewer) follows nobody.
 *  2. B likes A's review on A's PROFILE — a non-follow surface — BEFORE ever
 *     following A. This is the crux: a real like must attach to a real review
 *     that is discoverable without a follow relationship. The count and pressed
 *     state are server truth, and both survive a reload.
 *  3. B likes A's PUBLIC list from the real Community lists section, again
 *     without following.
 *  4. B follows A, then likes A's FOLLOWERS-ONLY list on its now-accessible
 *     detail page — proving a like attaches only once the list is visible.
 *  5. A likes their OWN review (self-likes are allowed by contract), taking the
 *     review to two distinct likers.
 *  6. B unfollows A: the followers-only list (and B's ability to see or toggle
 *     its like) disappears, while B's review like and public-list like — both
 *     on still-accessible targets — persist across a reload.
 *
 * This spec runs in its dedicated `@likes` suite (its own server + database
 * reset) rather than `@social`/`@fixtures`, because it re-provisions the shared
 * social accounts and those suites do the same; separate suites mean the
 * journeys can never race. Every write goes through the loopback-guarded
 * service-role helper; hosted Supabase can never be seeded or reset.
 */

/** A catalog title seeded in the local database (see supabase/seed). */
const REVIEW_TITLE = { slug: "dune-part-two", title: "Dune: Part Two" };

const PUBLIC_LIST = {
  slug: "a-public-likeable-collection",
  title: "A Public Likeable Collection",
  visibility: "public" as const,
};
const FOLLOWERS_LIST = {
  slug: "a-followers-likeable-collection",
  title: "A Followers Likeable Collection",
  visibility: "followers" as const,
};

const REVIEW_HEADING = "A turn worth marking";
const REVIEW_BODY =
  "A rare sequel that deepens the first film instead of merely extending it.";

/** The LikeButton accessible-name labels, mirrored from the components. */
const reviewLabel = `${SOCIAL_USER_A.displayName}'s review "${REVIEW_HEADING}"`;
const publicListLabel = `the list "${PUBLIC_LIST.title}"`;
const followersListLabel = `the list "${FOLLOWERS_LIST.title}"`;

async function signIn(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/sign-in/);
}

test.describe.serial("@likes review and list likes", () => {
  test("B likes A's review before following, likes lists, and likes persist across the follow lifecycle", async ({
    browser,
  }) => {
    // 1. Provision fresh A and B, then seed A's likeable content.
    await ensureSocialFixtureUsers();
    await seedStandaloneReviews(SOCIAL_USER_A.email, [
      {
        mediaSlug: REVIEW_TITLE.slug,
        createdAt: new Date().toISOString(),
        title: REVIEW_HEADING,
        body: REVIEW_BODY,
        rating: 4.5,
      },
    ]);
    await seedList(SOCIAL_USER_A.email, PUBLIC_LIST);
    await seedList(SOCIAL_USER_A.email, FOLLOWERS_LIST);

    const contextA = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const contextB = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await signIn(pageB, SOCIAL_USER_B);

      // ---------------------------------------------------------------------
      // Step 2: B likes A's review on A's profile — BEFORE following A.
      // ---------------------------------------------------------------------
      await pageB.goto(`/profile/${SOCIAL_USER_A.username}`);

      // The review is discoverable on this non-follow surface.
      await expect(
        pageB.getByRole("heading", { level: 3, name: REVIEW_HEADING }),
      ).toBeVisible();

      const likeReview = pageB.getByRole("button", {
        name: `Like ${reviewLabel}`,
      });
      await expect(likeReview).toBeVisible();
      await expect(likeReview).toHaveAttribute("aria-pressed", "false");
      // Count starts at 0 like(s).
      await expect(likeReview).toHaveAccessibleName(`Like ${reviewLabel}`);

      await likeReview.click();

      // Server truth: the button flips to Unlike and the count reflects 1.
      const unlikeReview = pageB.getByRole("button", {
        name: `Unlike ${reviewLabel}`,
      });
      await expect(unlikeReview).toBeVisible();
      await expect(unlikeReview).toHaveAttribute("aria-pressed", "true");
      await expect(pageB.getByText("1 like", { exact: false })).toBeVisible();

      // Reload proves the like persisted (no optimistic-only state).
      await pageB.reload();
      await expect(
        pageB.getByRole("button", { name: `Unlike ${reviewLabel}` }),
      ).toHaveAttribute("aria-pressed", "true");

      // ---------------------------------------------------------------------
      // Step 3: B likes A's PUBLIC list from Community lists — still not following.
      // ---------------------------------------------------------------------
      await pageB.goto("/lists");
      const communitySection = pageB.locator("section", {
        has: pageB.getByRole("heading", { level: 2, name: "Community lists" }),
      });
      const publicCard = communitySection.locator("article", {
        has: pageB.getByRole("heading", {
          level: 3,
          name: PUBLIC_LIST.title,
        }),
      });
      await expect(publicCard).toBeVisible();

      const likePublicList = publicCard.getByRole("button", {
        name: `Like ${publicListLabel}`,
      });
      await expect(likePublicList).toBeVisible();
      await likePublicList.click();
      await expect(
        publicCard.getByRole("button", { name: `Unlike ${publicListLabel}` }),
      ).toHaveAttribute("aria-pressed", "true");

      // Persist across reload.
      await pageB.reload();
      await expect(
        communitySection
          .locator("article", {
            has: pageB.getByRole("heading", {
              level: 3,
              name: PUBLIC_LIST.title,
            }),
          })
          .getByRole("button", { name: `Unlike ${publicListLabel}` }),
      ).toBeVisible();

      // The followers-only list is NOT visible while B does not follow A, and
      // its detail page is a 404.
      await expect(
        pageB.getByRole("heading", { level: 3, name: FOLLOWERS_LIST.title }),
      ).toHaveCount(0);
      const followersBefore = await pageB.goto(`/list/${FOLLOWERS_LIST.slug}`);
      expect(followersBefore?.status()).toBe(404);

      // ---------------------------------------------------------------------
      // Step 4: B follows A, then likes the now-accessible followers-only list.
      // ---------------------------------------------------------------------
      await pageB.goto(`/profile/${SOCIAL_USER_A.username}`);
      await pageB
        .getByRole("button", { name: `Follow ${SOCIAL_USER_A.displayName}` })
        .click();
      await expect(
        pageB.getByRole("button", {
          name: `Unfollow ${SOCIAL_USER_A.displayName}`,
        }),
      ).toBeVisible();

      const followersDetail = await pageB.goto(`/list/${FOLLOWERS_LIST.slug}`);
      expect(followersDetail?.status()).toBe(200);
      await expect(
        pageB.getByRole("heading", { level: 1, name: FOLLOWERS_LIST.title }),
      ).toBeVisible();

      const likeFollowersList = pageB.getByRole("button", {
        name: `Like ${followersListLabel}`,
      });
      await expect(likeFollowersList).toBeVisible();
      await likeFollowersList.click();
      await expect(
        pageB.getByRole("button", { name: `Unlike ${followersListLabel}` }),
      ).toHaveAttribute("aria-pressed", "true");

      // ---------------------------------------------------------------------
      // Step 5: A likes their OWN review — self-likes are allowed by contract.
      // ---------------------------------------------------------------------
      await signIn(pageA, SOCIAL_USER_A);
      await pageA.goto(`/profile/${SOCIAL_USER_A.username}`);
      const aLikesOwnReview = pageA.getByRole("button", {
        name: `Like ${reviewLabel}`,
      });
      await expect(aLikesOwnReview).toBeVisible();
      await aLikesOwnReview.click();
      await expect(
        pageA.getByRole("button", { name: `Unlike ${reviewLabel}` }),
      ).toHaveAttribute("aria-pressed", "true");
      // Two distinct likers (A and B) now.
      await expect(pageA.getByText("2 likes", { exact: false })).toBeVisible();

      // ---------------------------------------------------------------------
      // Step 6: B unfollows A. The followers-only list (and its like control)
      // disappears; the review + public-list likes on accessible targets stay.
      // ---------------------------------------------------------------------
      await pageB.goto(`/profile/${SOCIAL_USER_A.username}`);
      await pageB
        .getByRole("button", {
          name: `Unfollow ${SOCIAL_USER_A.displayName}`,
        })
        .click();
      await expect(
        pageB.getByRole("button", {
          name: `Follow ${SOCIAL_USER_A.displayName}`,
        }),
      ).toBeVisible();
      // Wait for the PERSISTED server truth, not just the returned action
      // state (same guard as feed.spec.ts): a freshly rendered profile must
      // show the unfollowed state before revocation is asserted, otherwise the
      // 404 check races the write instead of testing follower-only access.
      await expect
        .poll(
          async () => {
            await pageB.reload();
            return pageB
              .getByRole("button", {
                name: `Follow ${SOCIAL_USER_A.displayName}`,
              })
              .count();
          },
          { timeout: 20_000 },
        )
        .toBe(1);

      // Followers-only list detail is a 404 again.
      const followersAfter = await pageB.goto(`/list/${FOLLOWERS_LIST.slug}`);
      expect(followersAfter?.status()).toBe(404);

      // B's review like persists (review now shows 2 likes, B still pressed).
      await pageB.goto(`/profile/${SOCIAL_USER_A.username}`);
      await expect(
        pageB.getByRole("button", { name: `Unlike ${reviewLabel}` }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(pageB.getByText("2 likes", { exact: false })).toBeVisible();

      // B's public-list like persists on the still-accessible community card.
      await pageB.goto("/lists");
      const communityAfter = pageB.locator("section", {
        has: pageB.getByRole("heading", { level: 2, name: "Community lists" }),
      });
      await expect(
        communityAfter
          .locator("article", {
            has: pageB.getByRole("heading", {
              level: 3,
              name: PUBLIC_LIST.title,
            }),
          })
          .getByRole("button", { name: `Unlike ${publicListLabel}` }),
      ).toHaveAttribute("aria-pressed", "true");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
