/**
 * Data provenance + staleness for materialized catalog rows.
 *
 * A materialized row records enough provenance to answer, later and cheaply,
 * "is our stored copy still current?" without re-normalizing:
 *   - provider + external id (identity),
 *   - the normalization/document version it was produced under,
 *   - the last successful synchronization time,
 *   - a deterministic content hash of the normalized product.
 *
 * The content hash is a pure function of the normalized fields (plus the
 * version), so re-importing unchanged upstream data yields the SAME hash — the
 * staleness signal is stable and re-runs are cheap. This is deliberately
 * distinct from the embedding canonical-document hash: this one covers the whole
 * stored product (poster, backdrop, rating, details), not just the embeddable
 * text.
 */

import { createHash } from "node:crypto";

import { NORMALIZATION_VERSION } from "./config.ts";
import type { NormalizedMediaItem } from "./types";

/**
 * Build a stable, order-independent canonical object for hashing. Keys are
 * fixed and explicit (never `JSON.stringify` of the whole object, whose key
 * order is not guaranteed for dynamic shapes) so the hash is reproducible across
 * processes and runtimes.
 */
function canonicalShape(item: NormalizedMediaItem): Record<string, unknown> {
  const base: Record<string, unknown> = {
    v: NORMALIZATION_VERSION,
    provider: item.ref.provider,
    kind: item.kind,
    externalId: item.ref.externalId,
    title: item.title,
    subtitle: item.subtitle ?? null,
    synopsis: item.synopsis,
    year: item.year,
    genres: item.genres,
    posterUrl: item.posterUrl ?? null,
    backdropUrl: item.backdropUrl ?? null,
    averageRating: item.averageRating ?? null,
  };
  switch (item.kind) {
    case "movie":
      base.details = {
        runtimeMinutes: item.runtimeMinutes,
        director: item.director,
        cast: item.cast,
      };
      break;
    case "tv":
      base.details = {
        seasons: item.seasons,
        episodes: item.episodes,
        creators: item.creators,
        status: item.status,
      };
      break;
    case "book":
      base.details = {
        authors: item.authors,
        pageCount: item.pageCount,
        publisher: item.publisher ?? null,
      };
      break;
  }
  return base;
}

/**
 * Deterministic lowercase-hex SHA-256 of a normalized item's canonical shape.
 * The {@link NORMALIZATION_VERSION} is part of the shape, so a version bump
 * changes every hash and marks every stored row stale for a controlled re-sync.
 */
export function normalizedContentHash(item: NormalizedMediaItem): string {
  const json = JSON.stringify(canonicalShape(item));
  return createHash("sha256").update(json, "utf8").digest("hex");
}
