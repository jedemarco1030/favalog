/**
 * Trusted materialization: turn a { provider, kind, external id } identity into
 * a persisted Favalog catalog row.
 *
 * The flow is deliberately trust-minimizing:
 *   1. Validate the identity (provider/kind/external id) — the ONLY caller input.
 *   2. Re-fetch the TRUSTED upstream detail via the provider adapter and
 *      normalize it server-side. Caller-supplied titles/images/etc. are never
 *      accepted.
 *   3. Compute provenance (content hash + normalization version) and write the
 *      normalized product through the atomic, idempotent, collision-safe,
 *      canonically-resolving `materialize_external_media` RPC (Catalog Platform
 *      v1B). That RPC de-duplicates a provider identity to an existing Favalog
 *      title (exact link → existing provider row → conservative deterministic
 *      title+kind+year candidate) before ever creating a new row, so importing a
 *      provider result that Favalog already has never creates a duplicate.
 *
 * The RPC client is injected as a tiny interface, so this whole module is unit
 * testable with a fake provider + fake RPC and needs no database or generated
 * types. The server wiring (real registry + service-role client) lives in
 * `server-materializer.ts`.
 */

import { NORMALIZATION_VERSION, MAX_YEAR, MIN_YEAR } from "./config.ts";
import { CatalogProviderError, providerError } from "./errors.ts";
import { normalizedContentHash } from "./provenance.ts";
import type { ProviderRegistry } from "./provider-registry";
import type {
  CanonicalResolution,
  CatalogMaterializer,
  MaterializeInput,
  MaterializeResult,
  NormalizedMediaItem,
} from "./types";
import { externalKeyFor, validateMaterializeInput } from "./validation.ts";

/** Result envelope from the RPC client — mirrors supabase-js's `{ data, error }`. */
export interface CatalogRpcResult {
  data: unknown;
  error: { message: string } | null;
}

/** The DB write RPCs the materializer can target. */
export type CatalogMaterializeRpc =
  "materialize_external_media" | "materialize_media_item";

/** The minimal RPC surface the materializer needs. Injected for testability. */
export interface CatalogRpcClient {
  rpc(
    fn: CatalogMaterializeRpc,
    args: Record<string, unknown>,
  ): Promise<CatalogRpcResult>;
}

/**
 * The default trusted write path: the canonically-resolving v1B RPC, which
 * de-duplicates a provider identity to an existing Favalog title before writing.
 */
export const DEFAULT_MATERIALIZE_RPC: CatalogMaterializeRpc =
  "materialize_external_media";

/** Dependencies for {@link createCatalogMaterializer}. */
export interface MaterializerDeps {
  registry: ProviderRegistry;
  rpcClient: CatalogRpcClient;
  /**
   * Which DB write path to call. Defaults to {@link DEFAULT_MATERIALIZE_RPC}
   * (canonical resolution). The legacy v1A `materialize_media_item` may be used
   * for a raw, non-resolving write when explicitly required.
   */
  rpcFunction?: CatalogMaterializeRpc;
}

/** Build the kind-specific `details` payload (mirrors lib/supabase/mappers). */
export function buildDetails(
  item: NormalizedMediaItem,
): Record<string, unknown> {
  switch (item.kind) {
    case "movie":
      return {
        runtimeMinutes: item.runtimeMinutes,
        director: item.director,
        cast: item.cast,
      };
    case "tv":
      return {
        seasons: item.seasons,
        episodes: item.episodes,
        creators: item.creators,
        status: item.status,
      };
    case "book":
      return {
        authors: item.authors,
        pageCount: item.pageCount,
        ...(item.publisher ? { publisher: item.publisher } : {}),
      };
  }
}

/**
 * Guard that a normalized record is safe to persist: a non-empty title and a
 * plausible year (the DB CHECKs enforce the same, but a clean, mapped error
 * here beats a raw constraint violation). Throws a `validation` provider error.
 */
export function assertMaterializable(item: NormalizedMediaItem): void {
  if (!item.title || item.title.trim() === "") {
    throw providerError(
      {
        provider: item.ref.provider,
        operation: "materialize",
        category: "validation",
      },
      `[${item.ref.provider}] materialize failed: missing title`,
    );
  }
  if (
    !Number.isInteger(item.year) ||
    item.year < MIN_YEAR ||
    item.year > MAX_YEAR
  ) {
    throw providerError(
      {
        provider: item.ref.provider,
        operation: "materialize",
        category: "validation",
      },
      `[${item.ref.provider}] materialize failed: missing or implausible year`,
    );
  }
}

/** Narrow the RPC's returned jsonb into a {@link MaterializeResult}. */
function parseResult(
  data: unknown,
  input: MaterializeInput,
): MaterializeResult {
  if (!data || typeof data !== "object") {
    throw providerError({
      provider: input.provider,
      operation: "materialize",
      category: "unknown",
    });
  }
  const row = data as Record<string, unknown>;
  const mediaId = typeof row.media_id === "string" ? row.media_id : "";
  const slug = typeof row.slug === "string" ? row.slug : "";
  const syncedAt = typeof row.synced_at === "string" ? row.synced_at : "";
  if (!mediaId || !slug) {
    throw providerError({
      provider: input.provider,
      operation: "materialize",
      category: "unknown",
    });
  }
  const resolution = parseResolution(row.resolution);
  return {
    mediaId,
    slug,
    source: input.provider,
    externalId: input.externalId,
    kind: input.kind,
    inserted: row.inserted === true,
    syncedAt,
    ...(resolution ? { resolution } : {}),
  };
}

/** Narrow the RPC's `resolution` field to a known outcome, or `undefined`. */
function parseResolution(value: unknown): CanonicalResolution | undefined {
  return value === "created" || value === "linked" || value === "existing"
    ? value
    : undefined;
}

/** Create a {@link CatalogMaterializer} over an injected registry + RPC client. */
export function createCatalogMaterializer(
  deps: MaterializerDeps,
): CatalogMaterializer {
  return {
    async materialize(
      rawInput: MaterializeInput,
      signal?: AbortSignal,
    ): Promise<MaterializeResult> {
      const validated = validateMaterializeInput({
        provider: rawInput.provider,
        kind: rawInput.kind,
        externalId: rawInput.externalId,
      });
      if (!validated.ok) {
        throw providerError(
          {
            provider: rawInput.provider,
            operation: "materialize",
            category: "validation",
          },
          `materialize failed: ${validated.error}`,
        );
      }
      const input = validated.value;

      const provider = deps.registry.get(input.provider);
      const normalized = await provider.getByExternalId(
        {
          provider: input.provider,
          kind: input.kind,
          externalId: input.externalId,
        },
        signal,
      );
      assertMaterializable(normalized);

      const externalKey = externalKeyFor(
        input.provider,
        input.kind,
        input.externalId,
      );
      const contentHash = normalizedContentHash(normalized);

      const { data, error } = await deps.rpcClient.rpc(
        deps.rpcFunction ?? DEFAULT_MATERIALIZE_RPC,
        {
          p_source: input.provider,
          p_kind: input.kind,
          p_external_id: externalKey,
          p_title: normalized.title,
          p_subtitle: normalized.subtitle ?? null,
          p_synopsis: normalized.synopsis,
          p_year: normalized.year,
          p_poster_url: normalized.posterUrl ?? null,
          p_backdrop_url: normalized.backdropUrl ?? null,
          p_average_rating: normalized.averageRating ?? null,
          p_genres: normalized.genres,
          p_details: buildDetails(normalized),
          p_content_hash: contentHash,
          p_normalization_version: NORMALIZATION_VERSION,
        },
      );

      if (error) {
        throw providerError(
          {
            provider: input.provider,
            operation: "materialize",
            category: "unavailable",
          },
          `[${input.provider}] materialize failed: database write error`,
        );
      }

      return parseResult(data, input);
    },
  };
}

export { CatalogProviderError };
