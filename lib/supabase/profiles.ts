import "server-only";

import { createClient } from "@/lib/supabase/server";
import { mapProfileRowToDomain } from "@/lib/supabase/mappers";
import type { Profile } from "@/lib/types";

/**
 * Read a PUBLIC profile by username, or `null` when none exists.
 *
 * This is a public read (the `profiles` RLS policy permits anyone to select),
 * used by the transitional `/profile/[username]` route to render a real
 * Supabase-backed identity for usernames that are not mock demo users. The
 * lookup is case-insensitive because the `username` column is `citext`.
 *
 * It returns only the {@link Profile} identity — never derived activity — so a
 * newly-registered real user is never conflated with a mock user's diary,
 * reviews, or lists.
 */
export async function getPublicProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const handle = username.trim();
  if (handle === "") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", handle)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileRowToDomain(data);
}
