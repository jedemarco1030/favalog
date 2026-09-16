import { expect, test, type Page } from "@playwright/test";

import {
  SOCIAL_USER_A,
  SOCIAL_USER_B,
  SOCIAL_USER_C,
  detachReviewsByDeletingDiaryEntries,
  ensureFeedFixtureUsers,
  hasFixtureSupabaseTarget,
  seedDiaryActivity,
  seedPublicList,
  seedStandaloneReviews,
  type SeedDiaryEntrySpec,
} from "./fixtures/admin";

/**
 * End-to-end multi-user coverage for Phase 4B.2 — the real following feed.
 *
 * The complete journey, on seeded LOCAL Supabase:
 *
 *  1. A has real diary activity (including one entry with a LINKED review) and
 *     C has unrelated activity.
 *  2. B, following nobody, gets the truthful "following nobody" state.
 *  3. B discovers A through community lists and follows.
 *  4. Home shows A's REAL activity in the preview.
 *  5. "View all" opens `/feed` with the real feed.
 *  6. Refresh and "Load more" paginate correctly, with no duplicate card for
 *     the combined diary+review action.
 *  7. C's activity never appears anywhere in B's feed.
 *  8. A edits then deletes activity; B's refreshed feed reflects both.
 *  9. B unfollows A; A disappears from Home, the feed, and later pages.
 * 10. Signed-out navigation (including browser-back) never leaks B's feed.
 *
 * This spec runs in its dedicated `@social` suite rather than the `@fixtures`
 * suite: it re-provisions the shared social accounts, and the `@fixtures`
 * social-lists journey does the same. Its own server and database reset mean
 * the two journeys can never race each other.
 *
 * Every write goes through the loopback-guarded service-role helper in
 * `fixtures/admin.ts`; hosted Supabase can never be seeded or reset.
 */

/** Fixture titles. A's activity and C's activity use DISJOINT titles. */
const SPOILER_TITLE = { slug: "dune-part-two", title: "Dune: Part Two" };
const BACKDATED_TITLE = { slug: "paper-birds", title: "Paper Birds" };
const REWATCH_TITLE = { slug: "afterglow", title: "Afterglow" };
const TIE_DIARY_TITLE = { slug: "night-ferry", title: "Night Ferry" };
const TIE_REVIEW_TITLE = { slug: "salt-tide", title: "Salt Tide" };
const DETACHED_TITLE = { slug: "the-cartographer", title: "The Cartographer" };
/** Only ever logged by C — its presence anywhere in B's feed is a leak. */
const UNRELATED_TITLE = { slug: "the-gilded-room", title: "The Gilded Room" };

/** Filler titles, used only to push the feed past one page. */
const FILLER_SLUGS = [
  "arc-lighthouse",
  "blue-hour-run",
  "harbour-lines",
  "late-check-in",
  "low-country",
  "night-ferry",
  "northlight",
  "orbital-notes",
  "paper-lantern",
  "paper-watch",
  "quiet-instruments",
  "quiet-signal",
  "ridge-and-river",
  "seas-of-glass",
  "signal-glass",
  "slow-mountain",
  "the-bright-index",
  "the-north-room",
];

const SPOILER_REVIEW_BODY =
  "The second half turns on a revelation I still cannot unsee, and it reframes every quiet scene before it.";
const EDITED_REVIEW_BODY =
  "Edited after a second sitting: the revelation lands even harder when you already know it is coming.";

/** `new Date(...).toISOString()` for a deterministic offset from a base. */
function at(base: number, minutesAgo: number): string {
  return new Date(base - minutesAgo * 60_000).toISOString();
}

/**
 * Seed A's activity: 24 eligible items in total (22 diary entries plus 2
 * standalone reviews), so page one (20) is full and "Load more" has real work
 * to do. The fixtures deliberately include equal timestamps across BOTH source
 * types, a backdated diary date, a revisit, and spoiler-marked writing.
 */
async function seedAuthorActivity(base: number): Promise<void> {
  // Identical `created_at` on a diary entry and a standalone review: the total
  // order must still be deterministic across source types.
  const tieTimestamp = at(base, 40);

  const fillers: SeedDiaryEntrySpec[] = FILLER_SLUGS.map((slug, index) => ({
    mediaSlug: slug,
    createdAt: at(base, 100 + index * 5),
    rating: 3.5,
  }));

  await seedDiaryActivity(SOCIAL_USER_A.email, [
    // Newest: the combined action — one diary entry plus its linked review.
    {
      mediaSlug: SPOILER_TITLE.slug,
      createdAt: at(base, 5),
      rating: 4.5,
      review: {
        title: "A turn I cannot unsee",
        body: SPOILER_REVIEW_BODY,
        containsSpoilers: true,
      },
    },
    // A genuinely backdated diary date, logged months after the fact.
    {
      mediaSlug: BACKDATED_TITLE.slug,
      createdAt: at(base, 15),
      loggedAt: "2026-01-05T00:00:00.000Z",
      rating: 5,
    },
    // A revisit, so the wording must be "rewatched", never "watched".
    {
      mediaSlug: REWATCH_TITLE.slug,
      createdAt: at(base, 25),
      isRevisit: true,
    },
    // Equal-timestamp diary half of the tie.
    { mediaSlug: TIE_DIARY_TITLE.slug, createdAt: tieTimestamp, rating: 2.5 },
    // A diary entry whose linked review will be DETACHED at the database
    // level, proving `on delete set null` leaves a standalone review.
    {
      mediaSlug: DETACHED_TITLE.slug,
      createdAt: at(base, 50),
      rating: 4,
      review: { body: "A map of a city that never quite existed." },
    },
    ...fillers,
  ]);

  // Equal-timestamp standalone-review half of the tie.
  await seedStandaloneReviews(SOCIAL_USER_A.email, [
    {
      mediaSlug: TIE_REVIEW_TITLE.slug,
      createdAt: tieTimestamp,
      title: "Salt in everything",
      body: "A short, briny book that keeps its best sentence for the last page.",
      rating: 4,
    },
  ]);

  // Provoke the detached-review edge case.
  await detachReviewsByDeletingDiaryEntries(
    SOCIAL_USER_A.email,
    DETACHED_TITLE.slug,
  );

  // A public list so B can discover A through the real Community lists section.
  await seedPublicList(SOCIAL_USER_A.email, {
    slug: "a-feed-journey-collection",
    title: "A Feed Journey Collection",
    description: "Titles A keeps coming back to.",
  });
}

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

/** Every rendered feed card on the page. */
function cards(page: Page) {
  return page.getByRole("main").locator("article");
}

/** Cards that link to a given canonical title. */
function cardsForTitle(page: Page, slug: string) {
  return cards(page).filter({
    has: page.locator(`a[href="/title/${slug}"]`),
  });
}

test.describe.serial("@social Following feed journey", () => {
  test("a real, deduplicated, revocable feed across the whole journey", async ({
    browser,
  }) => {
    test.skip(
      !hasFixtureSupabaseTarget(),
      "Requires a LOCAL Supabase target. Run via `npm run test:e2e:social` " +
        "(start the stack with `npm run supabase:start`).",
    );
    // A long multi-account journey with several server-rendered navigations.
    test.setTimeout(240_000);

    const base = Date.now();
    await ensureFeedFixtureUsers();
    await seedAuthorActivity(base);
    // C's unrelated activity — never eligible for B, who never follows C.
    await seedDiaryActivity(SOCIAL_USER_C.email, [
      { mediaSlug: UNRELATED_TITLE.slug, createdAt: at(base, 2), rating: 5 },
      {
        mediaSlug: UNRELATED_TITLE.slug,
        createdAt: at(base, 1),
        isRevisit: true,
        review: { body: "Still the best hotel in television." },
      },
    ]);

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

    try {
      // ---------------------------------------------------------------------
      // Step 2: B follows nobody — the truthful empty state, not an error.
      // ---------------------------------------------------------------------
      await signIn(pageB, SOCIAL_USER_B);

      // The feed is discoverable from the primary navigation.
      const feedNavLink = pageB
        .locator("header")
        .getByRole("link", { name: "Feed" });
      await expect(feedNavLink).toHaveAttribute("href", "/feed");
      await feedNavLink.click();
      await expect(pageB).toHaveURL("/feed");

      await expect(
        pageB.getByRole("heading", { level: 1, name: "Feed" }),
      ).toBeVisible();
      await expect(
        pageB.getByText("You're not following anyone yet."),
      ).toBeVisible();
      await expect(
        pageB.getByRole("link", {
          name: "Find people through community lists",
        }),
      ).toBeVisible();
      await expect(cards(pageB)).toHaveCount(0);

      // Home tells the same truth, and never borrows example activity.
      await pageB.goto("/");
      const preview = pageB.locator('section[aria-label="From your circle"]');
      await expect(preview).toBeVisible();
      await expect(
        preview.getByText("You're not following anyone yet."),
      ).toBeVisible();

      // ---------------------------------------------------------------------
      // Step 3: B discovers A through community lists and follows.
      // ---------------------------------------------------------------------
      await pageB.goto("/lists");
      const communitySection = pageB.locator("section", {
        has: pageB.getByRole("heading", { level: 2, name: "Community lists" }),
      });
      const listCard = communitySection.locator("article", {
        has: pageB.getByRole("heading", {
          level: 3,
          name: "A Feed Journey Collection",
        }),
      });
      await expect(listCard).toBeVisible();
      await listCard
        .getByRole("link", { name: SOCIAL_USER_A.displayName })
        .click();
      await pageB.waitForURL(`/profile/${SOCIAL_USER_A.username}`);

      await pageB
        .getByRole("button", { name: `Follow ${SOCIAL_USER_A.displayName}` })
        .click();
      await expect(
        pageB.getByRole("button", {
          name: `Unfollow ${SOCIAL_USER_A.displayName}`,
        }),
      ).toBeVisible();

      // ---------------------------------------------------------------------
      // Step 4: Home now shows A's REAL activity in the preview.
      // ---------------------------------------------------------------------
      await pageB.goto("/");
      await expect(
        preview.getByRole("link", { name: SOCIAL_USER_A.displayName }).first(),
        // Generous, because a just-written follow can take a beat to be
        // visible to the next render.
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        preview.getByText("You're not following anyone yet."),
      ).toHaveCount(0);
      // The preview is bounded (6 items), not the whole feed.
      const previewCards = preview.locator("article");
      const previewCount = await previewCards.count();
      expect(previewCount).toBeGreaterThan(0);
      expect(previewCount).toBeLessThanOrEqual(6);
      // The newest activity leads, and it is the combined action.
      await expect(
        preview.locator("article").first().getByText("A turn I cannot unsee"),
      ).toBeVisible();

      // ---------------------------------------------------------------------
      // Step 5: "View all" opens the real feed.
      // ---------------------------------------------------------------------
      await preview.getByRole("link", { name: "View all" }).click();
      await expect(pageB).toHaveURL("/feed");

      // ---------------------------------------------------------------------
      // Step 6: page one, dedup, wording, spoilers, then "Load more".
      // ---------------------------------------------------------------------
      // A has 24 eligible items; page one is the bounded 20.
      //
      // The follow was written moments ago, and a brand-new relationship can
      // take a beat to become visible to a subsequent render. Poll (reloading
      // between attempts) rather than assume instant visibility — this
      // tolerates only write latency, never a wrong result: the assertion
      // below is still the exact bounded page size.
      await expect
        .poll(
          async () => {
            const count = await cards(pageB).count();
            if (count === 0) await pageB.reload();
            return count;
          },
          { timeout: 20_000 },
        )
        .toBe(20);

      // The combined diary + linked review is ONE card, never a separate
      // diary card and review card for the same action.
      const combined = cardsForTitle(pageB, SPOILER_TITLE.slug);
      await expect(combined).toHaveCount(1);
      await expect(combined.getByText("watched")).toBeVisible();
      await expect(combined.getByText("A turn I cannot unsee")).toBeVisible();

      // Spoiler-marked writing is genuinely concealed until explicitly
      // revealed — the body is not in the DOM beforehand.
      const reveal = combined.getByRole("button", {
        name: `Show spoilers for ${SPOILER_TITLE.title}`,
      });
      await expect(reveal).toHaveAttribute("aria-expanded", "false");
      await expect(pageB.getByText(SPOILER_REVIEW_BODY)).toHaveCount(0);
      // Keyboard operable, like any real button.
      await reveal.focus();
      await pageB.keyboard.press("Enter");
      await expect(pageB.getByText(SPOILER_REVIEW_BODY)).toBeVisible();

      // Source-backed wording only: a revisit is "rewatched", never "watched",
      // and nothing is ever "started" or "finished".
      const rewatch = cardsForTitle(pageB, REWATCH_TITLE.slug);
      await expect(rewatch.getByText("rewatched")).toBeVisible();
      await expect(pageB.getByText(/\bstarted\b/)).toHaveCount(0);
      await expect(pageB.getByText(/\bfinished\b/)).toHaveCount(0);

      // A backdated entry shows the user-chosen diary date separately.
      await expect(
        cardsForTitle(pageB, BACKDATED_TITLE.slug).getByText(/logged for/),
      ).toBeVisible();

      // The detached review (its diary entry was deleted) is now a standalone
      // "reviewed" item rather than vanishing or claiming a completion.
      await expect(
        cardsForTitle(pageB, DETACHED_TITLE.slug).getByText("reviewed"),
      ).toBeVisible();

      // Step 7: C is never in B's feed — B does not follow C.
      await expect(
        pageB.getByRole("link", { name: SOCIAL_USER_C.displayName }),
      ).toHaveCount(0);
      await expect(cardsForTitle(pageB, UNRELATED_TITLE.slug)).toHaveCount(0);

      // Every card offers separate, real destinations and no dead controls.
      const firstCard = cards(pageB).first();
      await expect(
        firstCard.locator(`a[href="/profile/${SOCIAL_USER_A.username}"]`),
      ).toHaveCount(1);
      await expect(
        firstCard.locator(`a[href="/title/${SPOILER_TITLE.slug}"]`),
      ).toHaveCount(2); // poster + title, siblings, never nested
      await expect(
        firstCard.locator(
          `a[href="/profile/${SOCIAL_USER_A.username}#reviews"]`,
        ),
      ).toHaveCount(1);
      // Never a link into another user's private diary.
      await expect(cards(pageB).locator('a[href^="/diary"]')).toHaveCount(0);

      // Refreshing restarts at the newest activity and stays deduplicated.
      await pageB.reload();
      await expect(cards(pageB)).toHaveCount(20);
      await expect(cardsForTitle(pageB, SPOILER_TITLE.slug)).toHaveCount(1);

      // "Load more" appends the remaining 4 items exactly once.
      await pageB.getByRole("button", { name: "Load more" }).click();
      await expect(cards(pageB)).toHaveCount(24);
      await expect(pageB.getByText(/caught up/)).toBeVisible();
      await expect(
        pageB.getByRole("button", { name: "Load more" }),
      ).toHaveCount(0);
      // Equal timestamps across both source types produced a stable total
      // order: both tie items are present, each exactly once.
      await expect(cardsForTitle(pageB, TIE_REVIEW_TITLE.slug)).toHaveCount(1);
      await expect(cardsForTitle(pageB, SPOILER_TITLE.slug)).toHaveCount(1);
      await expect(cardsForTitle(pageB, UNRELATED_TITLE.slug)).toHaveCount(0);

      // ---------------------------------------------------------------------
      // Step 8: A edits, then deletes, the combined activity.
      // ---------------------------------------------------------------------
      await signIn(pageA, SOCIAL_USER_A);
      await pageA.goto("/diary");
      await pageA
        .getByRole("button", {
          name: `Edit your log of ${SPOILER_TITLE.title}`,
        })
        .click();
      const editDialog = pageA.getByRole("dialog");
      await editDialog
        .getByLabel(/^Review \(optional\)$/)
        .fill(EDITED_REVIEW_BODY);
      await editDialog.getByRole("button", { name: "Save changes" }).click();
      await expect(editDialog).toBeHidden();

      // B's refreshed feed shows the edited content, and editing did NOT bump
      // the entry's position (`created_at` is never touched).
      await pageB.goto("/feed");
      const editedCard = cardsForTitle(pageB, SPOILER_TITLE.slug);
      await expect(editedCard).toHaveCount(1);
      await editedCard
        .getByRole("button", {
          name: `Show spoilers for ${SPOILER_TITLE.title}`,
        })
        .click();
      await expect(pageB.getByText(EDITED_REVIEW_BODY)).toBeVisible();
      await expect(pageB.getByText(SPOILER_REVIEW_BODY)).toHaveCount(0);
      await expect(cards(pageB).first()).toContainText(SPOILER_TITLE.title);

      // Deleting the entry removes it AND its linked review — no stale excerpt
      // is retained anywhere.
      await pageA.goto("/diary");
      await pageA
        .getByRole("button", {
          name: `Delete your log of ${SPOILER_TITLE.title}`,
        })
        .click();
      await pageA.getByRole("button", { name: "Delete entry" }).click();
      await expect(
        pageA.getByRole("button", {
          name: `Delete your log of ${SPOILER_TITLE.title}`,
        }),
      ).toHaveCount(0);

      await pageB.goto("/feed");
      await expect(cardsForTitle(pageB, SPOILER_TITLE.slug)).toHaveCount(0);
      await expect(pageB.getByText(EDITED_REVIEW_BODY)).toHaveCount(0);
      await expect(cards(pageB)).toHaveCount(20);

      // ---------------------------------------------------------------------
      // Step 9: B unfollows A — A disappears everywhere, including later pages.
      // ---------------------------------------------------------------------
      // Revocation ACROSS pages: B is holding page one with a pending "Load
      // more"; the unfollow happens in another tab of the SAME session, and
      // asking for page two must then return nothing. The cursor positions the
      // seek — it never grants access.
      await expect(
        pageB.getByRole("button", { name: "Load more" }),
      ).toBeVisible();

      const pageB2 = await contextB.newPage();
      await pageB2.goto(`/profile/${SOCIAL_USER_A.username}`);
      await pageB2
        .getByRole("button", { name: `Unfollow ${SOCIAL_USER_A.displayName}` })
        .click();
      // Wait for the PERSISTED server truth, not just the returned action
      // state: a freshly rendered profile must show the unfollowed state
      // before page two is requested, otherwise the next assertion would be
      // racing the write rather than testing revocation.
      await expect
        .poll(
          async () => {
            await pageB2.reload();
            return pageB2
              .getByRole("button", {
                name: `Follow ${SOCIAL_USER_A.displayName}`,
              })
              .count();
          },
          { timeout: 20_000 },
        )
        .toBe(1);
      await pageB2.close();

      const cardsBeforePageTwo = await cards(pageB).count();
      await pageB.getByRole("button", { name: "Load more" }).click();
      await expect(pageB.getByText(/caught up/)).toBeVisible();
      await expect(cards(pageB)).toHaveCount(cardsBeforePageTwo);

      // A fresh read has nothing left at all: B now follows nobody, so the
      // truthful state is "not following anyone", not "no activity".
      await pageB.goto("/feed");
      await expect(cards(pageB)).toHaveCount(0);
      await expect(
        pageB.getByText("You're not following anyone yet."),
      ).toBeVisible();

      await pageB.goto("/");
      await expect(
        preview.getByRole("link", { name: SOCIAL_USER_A.displayName }),
      ).toHaveCount(0);
      await expect(
        preview.getByText("You're not following anyone yet."),
      ).toBeVisible();

      // Browser-back must not replay the stale, followed-state feed.
      await pageB.goBack();
      await expect(pageB).toHaveURL("/feed");
      await expect(cards(pageB)).toHaveCount(0);

      // ---------------------------------------------------------------------
      // Step 10: no feed leakage when signed out or on another account.
      // ---------------------------------------------------------------------
      // An anonymous visitor is invited to sign in, never shown a feed.
      await anonPage.goto("/feed");
      const anonMain = anonPage.getByRole("main");
      await expect(
        anonMain.getByText("Sign in to follow people."),
      ).toBeVisible();
      // The invitation routes through the safe, same-origin `returnTo` flow.
      await expect(
        anonMain.getByRole("link", { name: "Sign in" }),
      ).toHaveAttribute("href", "/auth/sign-in?returnTo=%2Ffeed");
      await expect(cards(anonPage)).toHaveCount(0);

      // A different account sees ITS OWN feed state, never B's.
      await pageA.goto("/feed");
      await expect(
        pageA.getByText("You're not following anyone yet."),
      ).toBeVisible();
      await expect(cards(pageA)).toHaveCount(0);

      // After signing out, browser-back cannot resurrect the previous feed.
      await pageB.goto("/feed");
      await pageB.getByRole("button", { name: /^Account menu for/ }).click();
      await pageB.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(
        pageB.locator("header").getByRole("link", { name: "Sign in" }),
      ).toBeVisible();

      await pageB.goBack();
      await expect(cards(pageB)).toHaveCount(0);
      await expect(
        pageB.getByRole("link", { name: SOCIAL_USER_A.displayName }),
      ).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
      await anonContext.close();
    }
  });
});
