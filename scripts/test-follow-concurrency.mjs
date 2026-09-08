/**
 * Multi-session local concurrency test for `public.set_follow`.
 *
 * Proves that:
 * 1. Concurrent duplicate requests (e.g. two parallel follow requests) succeed
 *    safely without unique constraint collisions or duplicate rows.
 * 2. Concurrent opposite-state requests (follow vs unfollow) serialize cleanly
 *    via transaction advisory lock without deadlocks, leaving valid state.
 * 3. Rapid bursts of concurrent requests across multiple sessions preserve
 *    data integrity.
 *
 * Safety: uses `resolveLocalSupabaseEnv` so it NEVER runs against hosted/remote Supabase.
 * Run with: `node scripts/test-follow-concurrency.mjs`
 */

import { createClient } from "@supabase/supabase-js";
import { readLocalSupabaseEnv } from "./lib/local-supabase-target.mjs";

async function main() {
  console.log("Resolving local Supabase environment...");
  const env = readLocalSupabaseEnv();
  const supabaseUrl = env.apiUrl;
  const serviceKey = env.serviceRoleKey;
  const anonKey = env.anonKey;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log("Setting up temporary test users for concurrency testing...");
  const timestamp = Date.now();
  const userAEmail = `concur_a_${timestamp}@example.com`;
  const userBEmail = `concur_b_${timestamp}@example.com`;
  const userAUsername = `concur_a_${timestamp}`.slice(0, 25);
  const userBUsername = `concur_b_${timestamp}`.slice(0, 25);
  const password = "TestPassword123!";

  // Create User A and User B via admin API
  const { data: userAData, error: errA } =
    await adminClient.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
      user_metadata: { username: userAUsername, display_name: "User A" },
    });
  if (errA) throw new Error(`Failed to create User A: ${errA.message}`);

  const { data: userBData, error: errB } =
    await adminClient.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
      user_metadata: { username: userBUsername, display_name: "User B" },
    });
  if (errB) throw new Error(`Failed to create User B: ${errB.message}`);

  const userAId = userAData.user.id;
  const userBId = userBData.user.id;

  try {
    // Create two separate authenticated sessions for User A
    const clientA1 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
    const clientA2 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { error: signInErr1 } = await clientA1.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInErr1)
      throw new Error(`Client A1 sign in failed: ${signInErr1.message}`);

    const { error: signInErr2 } = await clientA2.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInErr2)
      throw new Error(`Client A2 sign in failed: ${signInErr2.message}`);

    // Wait a brief moment to absorb any Docker/host clock skew for newly issued JWT
    await new Promise((r) => setTimeout(r, 1500));

    // -------------------------------------------------------------------------
    // Test 1: Concurrent duplicate follows
    // -------------------------------------------------------------------------
    console.log("Test 1: Running concurrent duplicate follow requests...");
    const [res1, res2] = await Promise.all([
      clientA1.rpc("set_follow", {
        p_target_username: userBUsername,
        p_is_follow: true,
      }),
      clientA2.rpc("set_follow", {
        p_target_username: userBUsername,
        p_is_follow: true,
      }),
    ]);

    if (res1.error) throw new Error(`res1 error: ${res1.error.message}`);
    if (res2.error) throw new Error(`res2 error: ${res2.error.message}`);

    console.log("  Results from parallel follow:", res1.data, res2.data);
    if (!res1.data.is_following || !res2.data.is_following) {
      throw new Error("Both calls must report is_following = true");
    }

    // Verify exactly one row in DB
    const { count: count1, error: countErr1 } = await adminClient
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userAId)
      .eq("following_id", userBId);
    if (countErr1) throw new Error(`Count error: ${countErr1.message}`);
    if (count1 !== 1)
      throw new Error(`Expected exactly 1 follow row, got ${count1}`);
    console.log(
      "  PASS: Exactly 1 row in DB after concurrent follow requests.",
    );

    // -------------------------------------------------------------------------
    // Test 2: Concurrent opposite-state requests (follow vs unfollow)
    // -------------------------------------------------------------------------
    console.log(
      "Test 2: Running concurrent opposite-state requests (follow vs unfollow)...",
    );
    const [oppRes1, oppRes2] = await Promise.all([
      clientA1.rpc("set_follow", {
        p_target_username: userBUsername,
        p_is_follow: true,
      }),
      clientA2.rpc("set_follow", {
        p_target_username: userBUsername,
        p_is_follow: false,
      }),
    ]);

    if (oppRes1.error)
      throw new Error(`oppRes1 error: ${oppRes1.error.message}`);
    if (oppRes2.error)
      throw new Error(`oppRes2 error: ${oppRes2.error.message}`);

    console.log(
      "  Results from opposite-state calls:",
      oppRes1.data,
      oppRes2.data,
    );

    // Verify row count in DB is either 0 or 1, matching the state of whichever ran last
    const { count: count2, error: countErr2 } = await adminClient
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userAId)
      .eq("following_id", userBId);
    if (countErr2) throw new Error(`Count error: ${countErr2.message}`);
    if (count2 !== 0 && count2 !== 1) {
      throw new Error(`Expected valid DB row count (0 or 1), got ${count2}`);
    }
    console.log(`  PASS: DB state consistent (${count2} rows).`);

    // -------------------------------------------------------------------------
    // Test 3: Burst concurrency (10 parallel requests)
    // -------------------------------------------------------------------------
    console.log(
      "Test 3: Running burst of 10 concurrent alternating follow/unfollow requests...",
    );
    const burstPromises = [];
    for (let i = 0; i < 10; i++) {
      const isFollow = i % 2 === 0;
      const client = i % 2 === 0 ? clientA1 : clientA2;
      burstPromises.push(
        client.rpc("set_follow", {
          p_target_username: userBUsername,
          p_is_follow: isFollow,
        }),
      );
    }
    const burstResults = await Promise.all(burstPromises);
    for (const r of burstResults) {
      if (r.error) throw new Error(`Burst call failed: ${r.error.message}`);
    }

    const { count: count3 } = await adminClient
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userAId)
      .eq("following_id", userBId);
    if (count3 !== 0 && count3 !== 1) {
      throw new Error(`Expected valid DB row count (0 or 1), got ${count3}`);
    }
    console.log(
      `  PASS: Burst concurrency completed cleanly with valid DB state (${count3} rows).`,
    );

    console.log("\nAll multi-session concurrency tests passed successfully!");
  } finally {
    console.log("Cleaning up test users...");
    await adminClient.auth.admin.deleteUser(userAId);
    await adminClient.auth.admin.deleteUser(userBId);
  }
}

main().catch((err) => {
  console.error("Concurrency test failed:", err);
  process.exit(1);
});
