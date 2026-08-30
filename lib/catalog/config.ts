/**
 * Central, documented configuration for the trusted catalog-ingestion layer.
 *
 * Everything governing input limits, normalization bounds, request reliability,
 * and cache behaviour lives here so there is exactly one audited place to reason
 * about cost, latency, and abuse resistance. Nothing in this module reads a
 * secret or performs I/O — it is safe to import anywhere and never throws at
 * import time.
 *
 * Provider credentials (`TMDB_API_READ_TOKEN`, `OPEN_LIBRARY_CONTACT_EMAIL`)
 * are deliberately NOT read here; they are server-only and read inside the
 * respective adapters.
 */

/**
 * Version of the NORMALIZATION format (the set/shape of fields the adapters map
 * a provider record into, and the bounds applied). Recorded on every
 * materialized row so a later format change is auditable and can drive a
 * deliberate re-sync. Distinct from the embedding canonical-document version.
 */
export const NORMALIZATION_VERSION = "v1" as const;

// --- Input limits (server-controlled; never widened by a caller) ------------

/** Minimum accepted query length (characters, after trimming). */
export const MIN_QUERY_LENGTH = 2 as const;
/** Maximum accepted query length (characters, after trimming). */
export const MAX_QUERY_LENGTH = 120 as const;
/** Maximum 1-based page number a caller may request. */
export const MAX_PAGE = 20 as const;
/** Maximum candidates returned from a single provider search page. */
export const MAX_SEARCH_RESULTS = 25 as const;

// --- Normalization field bounds (applied to ALL provider content) -----------

/** Earliest / latest plausible release-or-publication year (matches the DB CHECK). */
export const MIN_YEAR = 1800 as const;
export const MAX_YEAR = 2200 as const;

/** Caps on stored text so no unbounded provider string is persisted. */
export const MAX_TITLE_LENGTH = 300 as const;
export const MAX_SUBTITLE_LENGTH = 300 as const;
export const MAX_SYNOPSIS_LENGTH = 4000 as const;
export const MAX_PERSON_NAME_LENGTH = 120 as const;
export const MAX_GENRE_LENGTH = 60 as const;
export const MAX_PUBLISHER_LENGTH = 200 as const;

/** Caps on stored arrays so no unbounded provider list is persisted. */
export const MAX_GENRES = 12 as const;
export const MAX_CAST = 12 as const;
export const MAX_CREATORS = 8 as const;
export const MAX_AUTHORS = 8 as const;

// --- Request reliability ----------------------------------------------------

/** Bounded per-request timeout for a single provider HTTP call. */
export const REQUEST_TIMEOUT_MS = 5000 as const;
/**
 * Maximum number of ATTEMPTS (initial try + retries) for a retryable failure.
 * Kept small so a struggling provider degrades quickly rather than hammering.
 */
export const MAX_ATTEMPTS = 3 as const;
/** Base delay for capped exponential backoff. */
export const RETRY_BASE_MS = 300 as const;
/** Ceiling for any single backoff delay. */
export const RETRY_MAX_MS = 4000 as const;
/**
 * Upper bound honoured for a server-supplied `Retry-After`. A hostile or
 * misconfigured provider cannot make us sleep arbitrarily long.
 */
export const RETRY_AFTER_MAX_MS = 10000 as const;

// --- Caching ----------------------------------------------------------------

/**
 * Cache time-to-live for provider search results (seconds). Search is the
 * highest-volume, most cache-friendly call; a short TTL absorbs repeated
 * queries while keeping results fresh. Consumed via the framework's fetch cache
 * (`next: { revalidate }`).
 */
export const SEARCH_CACHE_TTL_SECONDS = 3600 as const; // 60 * 60 = 1 hour
/**
 * Cache TTL for a provider detail fetch (seconds). Detail changes rarely, so a
 * longer TTL is appropriate; materialization always re-reads trusted detail but
 * benefits from the cache for repeated reads.
 */
export const DETAIL_CACHE_TTL_SECONDS = 86400 as const; // 24 * 60 * 60 = 24 hours

/**
 * Default locale/language for provider requests, documented and explicit rather
 * than provider-default. English metadata keeps normalized text consistent with
 * the existing curated catalog. A future phase may make this per-request.
 */
export const DEFAULT_LANGUAGE = "en-US" as const;
