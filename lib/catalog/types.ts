/**
 * Provider-neutral catalog contract for trusted external ingestion (Catalog
 * Platform v1A).
 *
 * The rest of Favalog must depend ONLY on the pure, normalized shapes in this
 * module — never on a raw TMDB or Open Library response. Adapters translate a
 * provider's wire format into these types at their boundary, so a provider swap,
 * a new provider, or a fixture/fake provider is invisible to callers.
 *
 * Nothing here performs I/O, reads a secret, or throws at import time: it is a
 * plain type/contract module safe to import from tests, server code, and the
 * pure core alike. Provider credentials and network access live only inside the
 * server-only adapters.
 */

import type { MediaKind } from "@/lib/types";

/**
 * The trusted external catalog providers Favalog integrates in this phase.
 * TMDB serves movies + TV; Open Library serves books. The union is closed so a
 * new provider is a deliberate, audited addition rather than an open string.
 */
export type ExternalProvider = "tmdb" | "openlibrary";

/**
 * A stable, provider-native reference to exactly one external record.
 *
 * `externalId` is the provider's own identifier for the item WITHIN its media
 * kind. TMDB reuses the same numeric id space for movies and TV, so the `kind`
 * is an inseparable part of identity — a movie and a TV show can share the
 * numeric id `123` and must never collide. Open Library uses a globally-unique
 * Work id (e.g. `OL45804W`) that already encodes its own namespace.
 *
 * This is the single unit of identity passed across the trusted-materialization
 * boundary; a caller (CLI or, later, a Server Action) may supply ONLY these
 * three fields — never any title, description, image, or ownership metadata.
 */
export interface ExternalRef {
  provider: ExternalProvider;
  kind: MediaKind;
  /** Provider-native id within `kind`. Opaque to the rest of the app. */
  externalId: string;
}

/**
 * A lightweight search hit from a provider — enough to render a candidate and
 * to re-fetch trusted detail before materialization. It deliberately does NOT
 * carry the full detail payload: search results are cheap, lossy previews and
 * are never trusted for persistence. Only `ref` + a trusted detail fetch drive
 * materialization.
 */
export interface CatalogSearchCandidate {
  ref: ExternalRef;
  kind: MediaKind;
  title: string;
  /** Release / first-publication year when the provider supplies one. */
  year?: number;
  /** Optional subtitle / original title, when present. */
  subtitle?: string;
  /**
   * A safe, provider-derived poster/cover URL when available. Always produced
   * from a provider-controlled image path against an approved host — never an
   * arbitrary caller-supplied URL. Absent when the provider has no image.
   */
  posterUrl?: string;
}

/** Kind-specific normalized detail for a movie. */
export interface NormalizedMovieDetails {
  kind: "movie";
  runtimeMinutes: number;
  director: string;
  cast: string[];
}

/** Kind-specific normalized detail for a TV series. */
export interface NormalizedTVDetails {
  kind: "tv";
  seasons: number;
  episodes: number;
  creators: string[];
  status: "ongoing" | "ended" | "upcoming";
}

/** Kind-specific normalized detail for a book. */
export interface NormalizedBookDetails {
  kind: "book";
  authors: string[];
  pageCount: number;
  publisher?: string;
}

/** Shared normalized fields, mirroring `MediaItemBase` minus Favalog-assigned identity. */
interface NormalizedMediaBase {
  /** The stable external reference this record was normalized from. */
  ref: ExternalRef;
  title: string;
  subtitle?: string;
  synopsis: string;
  year: number;
  genres: string[];
  /** Safe, provider-derived poster/cover URL, or `undefined` when missing. */
  posterUrl?: string;
  /** Safe, provider-derived wide backdrop URL, or `undefined` when missing. */
  backdropUrl?: string;
  /** Aggregate provider rating mapped to a 0–5 scale, when available. */
  averageRating?: number;
}

/**
 * A fully trusted, normalized catalog record ready to be materialized into
 * Favalog. This is a discriminated union on `kind` (mirroring the `MediaItem`
 * domain union) so kind-specific fields stay strictly typed. It carries NO
 * Favalog identity (`id`/`slug`): those are assigned server-side at
 * materialization and are immutable thereafter.
 *
 * All fields are the product of trusted server-side normalization from a
 * re-fetched provider detail record. Arrays and text are bounded by the
 * normalizer; no unbounded provider content reaches this shape.
 */
export type NormalizedMediaItem = NormalizedMediaBase &
  (NormalizedMovieDetails | NormalizedTVDetails | NormalizedBookDetails);

/**
 * One page of provider search results plus the coarse pagination metadata the
 * app needs to decide whether to offer "more". Cursor/paging semantics differ
 * per provider; this normalizes them to a 1-based page number and a `hasMore`
 * flag so callers never depend on a provider's raw paging shape.
 */
export interface ProviderPage<T> {
  items: T[];
  /** 1-based page number these items came from. */
  page: number;
  /** Total pages the provider reports, when known. */
  totalPages?: number;
  /** Whether a further page is available. */
  hasMore: boolean;
}

/** The media-kind filter a catalog search accepts. */
export type CatalogKindFilter = "all" | MediaKind;

/** Options for a provider search. `signal` enables timeout/abort. */
export interface CatalogSearchOptions {
  query: string;
  /** Restrict to a media kind, or `all` (default). A provider ignores kinds it does not serve. */
  kind?: CatalogKindFilter;
  /** 1-based page number (default 1). */
  page?: number;
  /** Abort signal for bounded timeouts. */
  signal?: AbortSignal;
}

/**
 * The provider-neutral adapter seam. Every provider (TMDB, Open Library, and
 * the deterministic fake used by tests/CLI) implements this identically, so the
 * materialization layer and operator tooling are provider-agnostic.
 */
export interface CatalogProvider {
  /** Stable provider id, used for logging, registry lookup, and identity. */
  readonly id: ExternalProvider;
  /** The media kinds this provider serves (TMDB: movie+tv; Open Library: book). */
  readonly kinds: readonly MediaKind[];
  /**
   * Search the provider. Excludes people/other entity types, disables adult
   * content, and returns only safe candidate previews. Degrades via a thrown
   * {@link CatalogProviderError} (never a raw provider error) on failure.
   */
  search(
    options: CatalogSearchOptions,
  ): Promise<ProviderPage<CatalogSearchCandidate>>;
  /**
   * Re-fetch ONE trusted item by its external reference and return the fully
   * normalized record. This is the only path trusted for materialization; it
   * never trusts caller-supplied metadata. Throws a {@link CatalogProviderError}
   * (category `not_found`) when the id does not resolve.
   */
  getByExternalId(
    ref: ExternalRef,
    signal?: AbortSignal,
  ): Promise<NormalizedMediaItem>;
}

/** The input accepted at the trusted-materialization boundary — identity only. */
export interface MaterializeInput {
  provider: ExternalProvider;
  kind: MediaKind;
  externalId: string;
}

/**
 * The identifier-only result of a materialization. Mirrors the "return only
 * identifiers/routing data" convention of the existing RPCs — never the full
 * normalized payload or any privileged data.
 */
export interface MaterializeResult {
  mediaId: string;
  /** The immutable Favalog slug assigned to this title. */
  slug: string;
  source: ExternalProvider;
  externalId: string;
  kind: MediaKind;
  /** True when a new row was created; false when an existing row was refreshed. */
  inserted: boolean;
  /** ISO timestamp of the successful synchronization. */
  syncedAt: string;
}

/**
 * The trusted materialization seam. The concrete implementation re-fetches the
 * upstream record via a {@link CatalogProvider}, normalizes it, and persists it
 * atomically and idempotently through the server-only DB write path. Kept as an
 * interface so tests can inject a deterministic implementation.
 */
export interface CatalogMaterializer {
  materialize(
    input: MaterializeInput,
    signal?: AbortSignal,
  ): Promise<MaterializeResult>;
}
