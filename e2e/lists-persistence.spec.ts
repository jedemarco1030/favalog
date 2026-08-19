import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage for the newly-wired persistent-list experience.
 *
 * ENVIRONMENT NOTE
 * ----------------
 * `playwright.config.ts` builds and starts the production app (`next build` +
 * `next start`) and runs everything against that single server. There is no
 * per-test control over the server's environment: it inherits whatever
 * Supabase configuration the machine provides (a real `.env.local` if present,
 * otherwise nothing). This suite therefore does NOT delete, move, or fabricate
 * `.env.local`, and it does NOT hardcode or invent Supabase credentials.
 *
 * As a result the tests split into two groups:
 *
 *  - ACTIVE (secret-free): behavior that is deterministic no matter how (or
 *    whether) Supabase is configured — namely that the persistent wiring never
 *    breaks the public, curated `/lists` browsing and never crashes the page.
 *
 *  - SKIPPED (documented): the authenticated create → add → view → profile →
 *    remove loop and real public/private list routing. These require an
 *    authenticated local Supabase session with disposable test credentials,
 *    which are not available in this environment (and secrets must never be
 *    committed). They are captured as `test.fixme` placeholders so the coverage
 *    intent is recorded without failing the suite.
 */

test.describe("Persistent lists — graceful degradation (secret-free)", () => {
  test("`/lists` renders curated content and never crashes without Supabase", async ({
    page,
  }) => {
    // With no Supabase env the real sections simply don't render, but the page
    // must still return 200 and present the curated mock browsing intact.
    const response = await page.goto("/lists");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { level: 1, name: "Lists" }),
    ).toBeVisible();

    // The controlled "Create list" affordance is always present (a disabled
    // button with no env, a sign-in link when signed out, a dialog trigger when
    // signed in). We only assert it exists and doesn't error the page.
    await expect(
      page
        .getByRole("button", { name: "Create list" })
        .or(page.getByRole("link", { name: "Create list" })),
    ).toBeVisible();

    // Curated examples always render as the secret-free fallback.
    await expect(
      page.getByRole("heading", { level: 2, name: "Curated examples" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Favorite Sci-Fi — a list by/ }).first(),
    ).toBeVisible();
  });

  test("a real list detail route falls back to the mock demonstration list", async ({
    page,
  }) => {
    // `/list/[slug]` resolves a real (persistent) list first, then falls back
    // to the mock demonstration list. With no Supabase env only the mock path
    // is reachable, so a known mock slug must still render its detail page with
    // the presentation-only Like/Share actions.
    await page.goto("/list/favorite-sci-fi");

    await expect(
      page.getByRole("heading", { level: 1, name: "Favorite Sci-Fi" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Like this list" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share this list" }),
    ).toBeVisible();
  });
});

test.describe("Persistent lists — authenticated flows (require Supabase)", () => {
  // BLOCKER (all tests below): these exercise real, owner-scoped writes/reads
  // through Supabase RPCs (`create_list` / `add_list_item` / `remove_list_item`)
  // and RLS-scoped reads. They need a running Supabase instance plus an
  // authenticated session created from disposable local test credentials. This
  // environment has no such credentials, and secrets must never be committed or
  // invented, so each scenario is marked `fixme` to record the intended
  // coverage without producing a false failure. Un-skip once a disposable local
  // Supabase auth fixture (e.g. a seeded confirmed test user + programmatic
  // sign-in helper) is wired into the e2e setup.

  test.fixme("create → add title → view list → see it on profile → remove title", async ({
    page,
  }) => {
    // Intended steps (owner session required end-to-end):
    // 1. Sign in as a disposable test user and complete onboarding.
    // 2. On `/lists`, use "Create list" to create a new list; assert the
    //    navigation to the server-returned canonical `/list/[slug]`.
    // 3. On a mock title (e.g. `/title/dune-part-two`), open "Add to list"
    //    and toggle the newly-created list on; assert the idempotent
    //    membership state.
    // 4. Visit `/list/[slug]` and assert the title now appears as an item.
    // 5. Visit the owner's `/profile/[username]` and assert the list shows in
    //    the real "Lists" section and the count reflects it.
    // 6. Back on the list detail, use owner-only "Remove from list" (with its
    //    confirmation) and assert the item is gone.
    expect(page).toBeTruthy();
  });

  test.fixme("a public real list is reachable by its globally-unique slug", async ({
    page,
  }) => {
    // Intended: a list created with `public` visibility resolves at
    // `/list/[slug]` for any visitor (including signed-out), showing its real
    // items — taking precedence over any mock list with the same slug.
    expect(page).toBeTruthy();
  });

  test.fixme("a private real list is not disclosed to a non-owner", async ({
    page,
  }) => {
    // Intended: a `private` list's slug resolves to the custom not-found
    // (404) experience for a non-owner / signed-out visitor — never leaking
    // its existence, name, or contents — while the owner can view it.
    expect(page).toBeTruthy();
  });
});
