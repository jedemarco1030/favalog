import "server-only";

import { cache } from "react";
import type { ExternalProvider } from "@/lib/catalog/types";
import { providerFromSource } from "@/lib/catalog/source-provider";
import type { MediaItem, MediaKind } from "@/lib/types";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";
import { mapMediaRowToDomain, type MediaItemRow } from "./mappers";

/**
 * Bounded reads of the real `media_items` catalog for Home.
 *
 * Home only ever reads Favalog's own catalog — never an external provider — so
 * its first render cannot wait on a slow third party. Every read is limited,
 * hides confirmed-removed provider rows (the same discovery filter Explore
 * uses), and reports `unavailable` / `error` instead of substituting mock data.
 */

export type HomeRead =
  | { status: "ok"; items: MediaItem[]; providers: ExternalProvider[] }
  | { status: "unavailable" }
  | { status: "error" };

/** Hard upper bound on any Home read. */
export const HOME_READ_MAX = 24;

type HomeQuery =
  | { by: "slugs"; slugs: readonly string[] }
  | { by: "recently_added"; kind?: MediaKind; limit: number }
  | { by: "min_year"; minYear: number; limit: number };

async function readHome(query: HomeQuery): Promise<HomeRead> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };
  try {
    const supabase = await createClient();
    let q = supabase
      .from("media_items")
      .select("*")
      .is("provider_removed_at", null);

    if (query.by === "slugs") {
      if (query.slugs.length === 0) {
        return { status: "ok", items: [], providers: [] };
      }
      q = q.in("slug", query.slugs.slice(0, HOME_READ_MAX));
    } else if (query.by === "recently_added") {
      if (query.kind) q = q.eq("kind", query.kind);
      q = q
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
    } else {
      q = q
        .gte("year", query.minYear)
        .order("year", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
    }

    const limit =
      query.by === "slugs"
        ? HOME_READ_MAX
        : Math.min(Math.max(1, query.limit), HOME_READ_MAX);
    const { data, error } = await q.limit(limit);
    if (error || !data) return { status: "error" };

    const rows = data as MediaItemRow[];
    const providers = new Set<ExternalProvider>();
    const items: MediaItem[] = [];
    for (const row of rows) {
      items.push(mapMediaRowToDomain(row));
      const provider = providerFromSource(row.source);
      if (provider) providers.add(provider);
    }
    return { status: "ok", items, providers: [...providers] };
  } catch {
    return { status: "error" };
  }
}

export const readFeaturedCandidates = cache(
  (slugs: readonly string[]): Promise<HomeRead> =>
    readHome({ by: "slugs", slugs }),
);

export const readRecentlyAdded = cache(
  (limit: number, kind?: MediaKind): Promise<HomeRead> =>
    readHome({ by: "recently_added", kind, limit }),
);

export const readReleaseWindow = cache(
  (minYear: number, limit: number): Promise<HomeRead> =>
    readHome({ by: "min_year", minYear, limit }),
);
