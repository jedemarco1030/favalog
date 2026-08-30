import "server-only";

/**
 * Read-only catalog reads from the persistent `public.media_items` table.
 *
 * Most consumer product pages still run on the `@/lib/data` mock catalog, but a
 * title MATERIALIZED from an external provider (Catalog Platform v1B) exists only
 * in Supabase. `/title/[slug]` therefore falls back to this reader when the mock
 * catalog has no match, so a freshly imported title resolves at its canonical
 * route and the existing Log / Rate / Review / Favorite / Add-to-list actions
 * work against it unchanged.
 *
 * `media_items` is public-read (RLS), so this uses the ordinary per-request SSR
 * client and works for signed-out visitors. It maps through the shared
 * {@link mapMediaRowToDomain} boundary — the UI never sees a raw row — and fails
 * safe to `null` (never throws) so a no-env build keeps rendering on mock data.
 */

import type { MediaItem } from "@/lib/types";
import { isSupabaseConfigured } from "./env";
import { mapMediaRowToDomain, type MediaItemRow } from "./mappers";
import { createClient } from "./server";

/**
 * Resolve a single catalog title by its immutable slug from Supabase, or `null`
 * when Supabase is unconfigured, the slug is unknown, or a read errors. Never
 * throws: an unresolved title simply falls through to `notFound()` upstream.
 */
export async function getRealMediaBySlug(
  slug: string,
): Promise<MediaItem | null> {
  const trimmed = typeof slug === "string" ? slug.trim() : "";
  if (trimmed === "" || !isSupabaseConfigured()) return null;

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("media_items")
    .select("*")
    .eq("slug", trimmed)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return mapMediaRowToDomain(data as MediaItemRow);
  } catch {
    // A malformed row (e.g. an unmapped future kind) should not crash the page.
    return null;
  }
}
