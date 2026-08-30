import "server-only";

/**
 * Read-only canonical resolution for federated Explore (Catalog Platform v1B).
 *
 * Before an external provider candidate is presented, the server must know
 * whether it ALREADY resolves to a Favalog title, so the UI can link straight to
 * the canonical `/title/[slug]` and never offer to import a duplicate. This
 * module answers that question with a cheap, read-only lookup against the two
 * identity authorities, in the same order the write path resolves:
 *
 *   1. `public.media_external_ids` — an explicit provider→canonical alias
 *      (the strongest signal: an exact provider link).
 *   2. `public.media_items (source, external_id)` — a provider row materialized
 *      before the alias existed (or via v1A's `materialize_media_item`).
 *
 * It deliberately does NOT perform the conservative deterministic
 * (title+kind+year) candidate match here: that lives only in the atomic write
 * path (`materialize_external_media`), where it is serialized and fail-safe.
 * Surfacing a title as "already in Favalog" only on an EXACT identity match keeps
 * the read honest — a never-imported title stays importable, and the write path
 * is the single place that may attach a deterministic candidate.
 *
 * Both tables are public-read (RLS), so this uses the ordinary per-request SSR
 * client and works for signed-out visitors. It never writes, never reads a
 * secret, and returns only `{ externalKey -> canonical slug }`.
 */

import type { ExternalProvider } from "@/lib/catalog/types";
import type { MediaKind } from "@/lib/types";
import { externalKeyFor } from "@/lib/catalog/validation";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";

/** The minimal identity of a provider candidate needed to resolve it. */
export interface ResolvableRef {
  kind: MediaKind;
  /** Provider-native id within its kind (numeric for TMDB, Work id for books). */
  externalId: string;
}

/**
 * Resolve a batch of provider candidates (all from ONE provider) to their
 * canonical Favalog slugs, by EXACT identity only.
 *
 * Returns a map from the DB-native external key (see {@link externalKeyFor}) to
 * the canonical slug, containing an entry ONLY for candidates that already exist
 * in Favalog. Candidates absent from the map are not yet materialized
 * (importable). Fails safe: when Supabase is unconfigured, there are no
 * candidates, or a read errors, it returns an EMPTY map (everything treated as
 * importable) rather than throwing — a federated section must never break the
 * page.
 */
export async function resolveExternalRefs(
  provider: ExternalProvider,
  refs: readonly ResolvableRef[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (!isSupabaseConfigured() || refs.length === 0) return resolved;

  // De-duplicate the keys we look up (a provider page can repeat nothing, but a
  // caller might); preserve the mapping back to the DB-native external key.
  const keys = Array.from(
    new Set(
      refs.map((ref) => externalKeyFor(provider, ref.kind, ref.externalId)),
    ),
  );

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return resolved;
  }

  // (1) Explicit provider→canonical aliases. `media_items` is inner-joined so
  // only links pointing at a live canonical row are returned.
  try {
    const { data, error } = await supabase
      .from("media_external_ids")
      .select("external_id, media_items!inner(slug)")
      .eq("provider", provider)
      .in("external_id", keys);
    if (!error && data) {
      for (const row of data as AliasRow[]) {
        const slug = row.media_items?.slug;
        if (row.external_id && slug) resolved.set(row.external_id, slug);
      }
    }
  } catch {
    // Ignore: a failed alias read simply leaves those candidates importable.
  }

  // (2) Provider rows without an alias yet (backfilled by the write path later).
  const unresolved = keys.filter((key) => !resolved.has(key));
  if (unresolved.length > 0) {
    try {
      const { data, error } = await supabase
        .from("media_items")
        .select("external_id, slug")
        .eq("source", provider)
        .in("external_id", unresolved);
      if (!error && data) {
        for (const row of data as MediaRow[]) {
          if (row.external_id && row.slug)
            resolved.set(row.external_id, row.slug);
        }
      }
    } catch {
      // Ignore: leave those candidates importable.
    }
  }

  return resolved;
}

/** Shape of a joined `media_external_ids` row projection. */
interface AliasRow {
  external_id: string | null;
  media_items: { slug: string | null } | null;
}

/** Shape of a `media_items` identity projection. */
interface MediaRow {
  external_id: string | null;
  slug: string | null;
}
