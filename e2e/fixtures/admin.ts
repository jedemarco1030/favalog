import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  assertLoopbackSupabaseUrl,
  isSupabaseTargetAbsent,
} from "../../scripts/lib/local-supabase-target.mjs";

import { emitCiNotice } from "./ci-notice";

/**
 * Service-role Supabase helpers for the fixture-backed E2E suite.
 *
 * These run in the Playwright RUNNER process (not the app), so they need the
 * local Supabase URL + service-role key that `scripts/run-e2e-local.mjs`
 * resolves from the running local stack (never `.env.local`) and injects into
 * the environment. They are used only to provision a test user and to make
 * authoritative "exactly once / no duplicate" assertions against local
 * Supabase, and every admin client is loopback-gated by
 * `assertLoopbackSupabaseUrl`. No secrets are hard-coded here.
 */

/** The deterministic test account provisioned for authenticated fixtures specs. */
export const FIXTURE_USER = {
  email: "e2e-materialize@example.com",
  password: "Fixture-Passw0rd!23",
  username: "e2ematerialize",
  displayName: "E2E Materialize",
} as const;

/**
 * Three test accounts for multi-user social testing: A and B drive the follow
 * lifecycle and follower-aware lists, and C is a third, completely unrelated
 * account used to prove that a non-followed user's activity never leaks into
 * another viewer's following feed.
 */
export const SOCIAL_USER_A = {
  email: "social_a@example.com",
  password: "Fixture-Passw0rd!23",
  username: "social_a",
  displayName: "Social User A",
} as const;

export const SOCIAL_USER_B = {
  email: "social_b@example.com",
  password: "Fixture-Passw0rd!23",
  username: "social_b",
  displayName: "Social User B",
} as const;

export const SOCIAL_USER_C = {
  email: "social_c@example.com",
  password: "Fixture-Passw0rd!23",
  username: "social_c",
  displayName: "Social User C",
} as const;

/** The shape of a provisionable fixture account. */
export interface FixtureAccount {
  readonly email: string;
  readonly password: string;
  readonly username: string;
  readonly displayName: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback ?? "").trim();
  if (!value) {
    throw new Error(
      `[e2e fixtures] Missing ${name}. The fixtures suite needs LOCAL Supabase ` +
        `credentials injected by scripts/run-e2e-local.mjs (run the suite via ` +
        `"npm run test:e2e:fixtures"; start the stack with "npm run supabase:start").`,
    );
  }
  return value;
}

/**
 * Skip-gate input: a Supabase target is "available" unless NOTHING is
 * configured at all. This is deliberately an ABSENCE check only — a present
 * hosted URL still fails loudly through `assertLoopbackSupabaseUrl`, and a
 * loopback URL with a missing service-role key still fails through
 * `requireEnv`. When no target exists the skip is announced in CI so it can
 * never be mistaken for coverage.
 */
export function hasFixtureSupabaseTarget(): boolean {
  const available = !isSupabaseTargetAbsent(process.env);
  if (!available) {
    emitCiNotice(
      "Following feed journey skipped",
      "No Supabase target is configured, so the service-role fixtures cannot " +
        "seed the journey. Run it via `npm run test:e2e:social` against LOCAL " +
        "Supabase (`npm run supabase:start`).",
    );
  }
  return available;
}

/** Build a service-role admin client against local Supabase. */
export function createAdminClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = requireEnv(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  // Hard gate: refuse to build an admin client (and therefore to provision a
  // user or write any row) unless the target is an unambiguous LOCAL loopback
  // Supabase URL. There is no override that permits a hosted target.
  assertLoopbackSupabaseUrl(url, "SUPABASE_URL");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Ensure the fixture user exists as a CONFIRMED, ONBOARDED account. The
 * `handle_new_user` trigger provisions a complete profile from the supplied
 * `user_metadata` (username + display_name), so the account is onboarding-clean
 * on a freshly reset local database.
 */
export async function ensureFixtureUser(): Promise<void> {
  const admin = createAdminClient();

  // Remove any pre-existing account for a deterministic starting point.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === FIXTURE_USER.email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { error } = await admin.auth.admin.createUser({
    email: FIXTURE_USER.email,
    password: FIXTURE_USER.password,
    email_confirm: true,
    user_metadata: {
      username: FIXTURE_USER.username,
      display_name: FIXTURE_USER.displayName,
    },
  });
  if (error) {
    throw new Error(
      `[e2e fixtures] Failed to create fixture user: ${error.message}`,
    );
  }
}

/**
 * Recreate the given accounts as confirmed, onboarded users, deleting any
 * pre-existing account first so every run starts from a deterministic state.
 * Deleting the auth user cascades through `profiles` and therefore through all
 * of that user's diary entries, reviews, lists, follows, and favorites.
 */
export async function ensureFixtureAccounts(
  accounts: readonly FixtureAccount[],
): Promise<void> {
  const admin = createAdminClient();

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const account of accounts) {
    const existing = list?.users.find((u) => u.email === account.email);
    if (existing) await admin.auth.admin.deleteUser(existing.id);
  }

  for (const account of accounts) {
    const { error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        username: account.username,
        display_name: account.displayName,
      },
    });
    if (error) {
      throw new Error(
        `[e2e fixtures] Failed to create ${account.username}: ${error.message}`,
      );
    }
  }
}

/**
 * Ensure two distinct confirmed, onboarded social users exist.
 */
export async function ensureSocialFixtureUsers(): Promise<void> {
  await ensureFixtureAccounts([SOCIAL_USER_A, SOCIAL_USER_B]);
}

/**
 * Ensure the three accounts the following-feed journey needs exist: an author
 * (A), a viewer (B), and an unrelated third account (C).
 */
export async function ensureFeedFixtureUsers(): Promise<void> {
  await ensureFixtureAccounts([SOCIAL_USER_A, SOCIAL_USER_B, SOCIAL_USER_C]);
}

/** Resolve a fixture account's user id (= its `profiles.id`). */
export async function getFixtureUserId(email: string): Promise<string> {
  const admin = createAdminClient();
  const { data: list, error } = await admin.auth.admin.listUsers({
    perPage: 200,
  });
  if (error) {
    throw new Error(`[e2e fixtures] Listing users failed: ${error.message}`);
  }
  const user = list?.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(`[e2e fixtures] No provisioned user for ${email}.`);
  }
  return user.id;
}

/** Resolve catalog ids for the given slugs in one round trip. */
async function resolveMediaIds(
  slugs: readonly string[],
): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const unique = [...new Set(slugs)];
  const { data, error } = await admin
    .from("media_items")
    .select("id, slug")
    .in("slug", unique);
  if (error) {
    throw new Error(`[e2e fixtures] Media lookup failed: ${error.message}`);
  }
  const rows = (data ?? []) as { id: string; slug: string }[];
  const map = new Map(rows.map((row) => [row.slug, row.id]));
  for (const slug of unique) {
    if (!map.has(slug)) {
      throw new Error(
        `[e2e fixtures] Catalog slug "${slug}" is not seeded locally.`,
      );
    }
  }
  return map;
}

/**
 * One seeded diary entry, with full control over the immutable ordering time
 * (`createdAt`) and the user-chosen diary date (`loggedAt`) so the suite can
 * exercise equal timestamps, multiple pages, and backdated entries.
 */
export interface SeedDiaryEntrySpec {
  mediaSlug: string;
  /** Immutable record creation time — the feed's ordering key. */
  createdAt: string;
  /** User-selected diary date; defaults to `createdAt`. */
  loggedAt?: string;
  rating?: number | null;
  isRevisit?: boolean;
  /** An optional review linked to this entry (renders as ONE feed item). */
  review?: {
    title?: string;
    body: string;
    containsSpoilers?: boolean;
  };
}

/**
 * Seed diary entries (and their optional linked reviews) for a fixture user
 * with exact timestamps. Written with the service-role client against LOCAL
 * Supabase only, which is how timestamps that the application deliberately
 * controls (`created_at`) can be made deterministic.
 */
export async function seedDiaryActivity(
  email: string,
  specs: readonly SeedDiaryEntrySpec[],
): Promise<void> {
  if (specs.length === 0) return;
  const admin = createAdminClient();
  const userId = await getFixtureUserId(email);
  const media = await resolveMediaIds(specs.map((spec) => spec.mediaSlug));

  const toRow = (spec: SeedDiaryEntrySpec) => ({
    user_id: userId,
    media_id: media.get(spec.mediaSlug)!,
    logged_at: spec.loggedAt ?? spec.createdAt,
    rating: spec.rating ?? null,
    is_revisit: spec.isRevisit ?? false,
    created_at: spec.createdAt,
    updated_at: spec.createdAt,
  });

  // Entries without a review go in one batch; entries WITH a review are
  // inserted one at a time so the returned id is unambiguously theirs (a bulk
  // insert makes no promise about result order).
  const plain = specs.filter((spec) => !spec.review);
  if (plain.length > 0) {
    const { error } = await admin
      .from("diary_entries")
      .insert(plain.map(toRow));
    if (error) {
      throw new Error(`[e2e fixtures] Diary seed failed: ${error.message}`);
    }
  }

  for (const spec of specs) {
    if (!spec.review) continue;
    const { data, error } = await admin
      .from("diary_entries")
      .insert(toRow(spec))
      .select("id")
      .single();
    if (error) {
      throw new Error(`[e2e fixtures] Diary seed failed: ${error.message}`);
    }
    const entryId = (data as { id: string }).id;
    const { error: reviewError } = await admin.from("reviews").insert({
      user_id: userId,
      media_id: media.get(spec.mediaSlug)!,
      diary_entry_id: entryId,
      title: spec.review.title ?? null,
      body: spec.review.body,
      // A linked review never carries its own rating — the diary entry is the
      // rating source of truth (enforced by a CHECK constraint).
      rating: null,
      contains_spoilers: spec.review.containsSpoilers ?? false,
      created_at: spec.createdAt,
      updated_at: spec.createdAt,
    });
    if (reviewError) {
      throw new Error(
        `[e2e fixtures] Linked review seed failed: ${reviewError.message}`,
      );
    }
  }
}

/** A standalone review — an independent record with no diary entry. */
export interface SeedStandaloneReviewSpec {
  mediaSlug: string;
  createdAt: string;
  title?: string;
  body: string;
  rating?: number | null;
  containsSpoilers?: boolean;
}

export async function seedStandaloneReviews(
  email: string,
  specs: readonly SeedStandaloneReviewSpec[],
): Promise<void> {
  if (specs.length === 0) return;
  const admin = createAdminClient();
  const userId = await getFixtureUserId(email);
  const media = await resolveMediaIds(specs.map((spec) => spec.mediaSlug));

  const { error } = await admin.from("reviews").insert(
    specs.map((spec) => ({
      user_id: userId,
      media_id: media.get(spec.mediaSlug),
      diary_entry_id: null,
      title: spec.title ?? null,
      body: spec.body,
      rating: spec.rating ?? null,
      contains_spoilers: spec.containsSpoilers ?? false,
      created_at: spec.createdAt,
      updated_at: spec.createdAt,
    })),
  );
  if (error) {
    throw new Error(
      `[e2e fixtures] Standalone review seed failed: ${error.message}`,
    );
  }
}

/**
 * Seed a public list for a fixture user so another account can discover them
 * through the real "Community lists" section rather than a typed profile URL.
 */
export async function seedPublicList(
  email: string,
  list: { slug: string; title: string; description?: string },
): Promise<void> {
  const admin = createAdminClient();
  const userId = await getFixtureUserId(email);
  const { error } = await admin.from("lists").insert({
    user_id: userId,
    slug: list.slug,
    title: list.title,
    description: list.description ?? null,
    visibility: "public",
  });
  if (error) {
    throw new Error(`[e2e fixtures] Public list seed failed: ${error.message}`);
  }
}

/**
 * Delete a user's diary entries for one title at the DATABASE level, bypassing
 * the application RPC (which also removes the linked review). This is how the
 * `on delete set null` edge case is provoked: the review survives, detached,
 * and must then be treated as a standalone review.
 */
export async function detachReviewsByDeletingDiaryEntries(
  email: string,
  mediaSlug: string,
): Promise<void> {
  const admin = createAdminClient();
  const userId = await getFixtureUserId(email);
  const media = await resolveMediaIds([mediaSlug]);
  const { error } = await admin
    .from("diary_entries")
    .delete()
    .eq("user_id", userId)
    .eq("media_id", media.get(mediaSlug)!);
  if (error) {
    throw new Error(`[e2e fixtures] Diary delete failed: ${error.message}`);
  }
}

/**
 * Count catalog rows matching a `(source, external_id)` identity — the
 * authoritative "materialized exactly once / no duplicate" check.
 */
export async function countMediaByExternalId(
  source: string,
  externalId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("source", source)
    .eq("external_id", externalId);
  if (error) {
    throw new Error(
      `[e2e fixtures] Count by external id failed: ${error.message}`,
    );
  }
  return count ?? 0;
}

/** Count catalog rows for a given slug (used to prove no duplicate title). */
export async function countMediaBySlug(slug: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("slug", slug);
  if (error) {
    throw new Error(`[e2e fixtures] Count by slug failed: ${error.message}`);
  }
  return count ?? 0;
}
