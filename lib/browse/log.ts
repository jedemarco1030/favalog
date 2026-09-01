/**
 * Structured, privacy-preserving operational telemetry for Explore *browse*.
 *
 * Like the search telemetry in `@/lib/search/log`, this is a VERSIONED, CLOSED
 * event of safe, non-sensitive fields only. Browse has no free-text query, but
 * we still take the same care: NO user identity, NO media title/slug, NO raw
 * genre text, NO credentials, and NO exact potentially-identifying counts —
 * only coarse, low-cardinality operational signals (sort, media type, whether a
 * genre filter is active, a BUCKETED result count, page/cursor state, a coarse
 * latency bucket, and the outcome).
 *
 * Vercel custom analytics events are unavailable on the current plan, so this is
 * emitted purely as a server-side structured JSON log line (no paid dependency).
 *
 * {@link buildBrowseLog} returns the complete, closed event (pure, easy to
 * unit-test for redaction); {@link logBrowse} emits it. Emission is
 * dependency-injected in the browse DAL so tests never require any transport.
 */

/** The single, stable event name every browse telemetry line carries. */
export const BROWSE_LOG_EVENT = "catalog_browse" as const;

/**
 * Schema version of the closed browse-telemetry event. Bump whenever the
 * emitted field set changes so downstream consumers can adapt.
 */
export const BROWSE_LOG_SCHEMA_VERSION = 1 as const;

/** Coarse outcome of a browse request. */
export type BrowseOutcomeKind = "ok" | "unavailable" | "error";

/**
 * Bucket a result count into a small, fixed set of ranges so no exact,
 * potentially-identifying count is emitted. Mirrors the search analytics
 * bucketing vocabulary.
 */
export function browseResultCountBucket(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count <= 3) return "1-3";
  if (count <= 10) return "4-10";
  if (count <= 24) return "11-24";
  return "25+";
}

/** Bucket a millisecond latency into a coarse band. */
export function latencyBucket(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "unknown";
  if (ms < 50) return "<50ms";
  if (ms < 200) return "50-200ms";
  if (ms < 500) return "200-500ms";
  if (ms < 1000) return "500-1000ms";
  return "1000ms+";
}

/**
 * The safe, closed set of INPUT fields the browse DAL supplies. The emitted
 * event ({@link BrowseLogEvent}) adds the fixed event name and schema version.
 */
export interface BrowseLogFields {
  /** Coarse outcome. */
  outcome: BrowseOutcomeKind;
  /** Allow-listed global sort key. */
  sort: string;
  /** Allow-listed media-type filter (`all` | `movie` | `tv` | `book`). */
  mediaType: string;
  /** Whether a genre filter was applied (never the genre text itself). */
  genreFiltered: boolean;
  /** 1-based page requested/clamped to. */
  page: number;
  /** Total number of pages for the current filter set. */
  totalPages: number;
  /** Bucketed count of results on the returned page. */
  resultCountBucket: string;
  /** Coarse latency band for the browse read. */
  latencyBucket: string;
}

/** The complete, closed telemetry event as emitted. */
export interface BrowseLogEvent extends BrowseLogFields {
  event: typeof BROWSE_LOG_EVENT;
  schemaVersion: typeof BROWSE_LOG_SCHEMA_VERSION;
}

/**
 * Build the closed, redacted telemetry event. Single audited choke point: the
 * input type already excludes sensitive fields, and this only copies
 * allow-listed keys and stamps the event name + schema version.
 */
export function buildBrowseLog(fields: BrowseLogFields): BrowseLogEvent {
  return {
    event: BROWSE_LOG_EVENT,
    schemaVersion: BROWSE_LOG_SCHEMA_VERSION,
    outcome: fields.outcome,
    sort: fields.sort,
    mediaType: fields.mediaType,
    genreFiltered: fields.genreFiltered,
    page: fields.page,
    totalPages: fields.totalPages,
    resultCountBucket: fields.resultCountBucket,
    latencyBucket: fields.latencyBucket,
  };
}

/** Emit the closed browse telemetry event as a single structured JSON line. */
export function logBrowse(fields: BrowseLogFields): void {
  console.info(JSON.stringify(buildBrowseLog(fields)));
}
