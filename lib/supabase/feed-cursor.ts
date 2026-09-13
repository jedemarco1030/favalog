/**
 * Pure, versioned keyset cursor for the following feed.
 *
 * The cursor is an OPAQUE POSITION, never an authorization: every page
 * re-derives `auth.uid()` and re-joins `public.follows` server-side, so a
 * forged or replayed cursor can only move the seek within rows the viewer is
 * already allowed to read.
 *
 * Wire format: `v1:<created_at>:<source>:<activity_id>`
 *
 * The timestamp is carried as the EXACT string PostgREST returned (microsecond
 * precision and original UTC offset included). It is never round-tripped
 * through a JavaScript `Date`, which would silently truncate to milliseconds
 * and could skip or repeat a row at a page boundary.
 *
 * Kept free of any server/Supabase import so it can be unit-tested in
 * isolation and reused by the server-only read layer.
 */

/** The two source types the feed derives activity from. */
export type FeedSource = "diary" | "review";

/** A decoded, validated cursor position. */
export interface FeedCursor {
  /** Exact database `created_at` string (microseconds preserved). */
  createdAt: string;
  source: FeedSource;
  /** The source row's uuid. */
  id: string;
}

/** The loose shape a database row offers when a cursor is built from it. */
export interface FeedCursorInput {
  createdAt?: string | null;
  source?: string | null;
  id?: string | null;
}

const CURSOR_VERSION = "v1";

const FEED_SOURCES: readonly string[] = ["diary", "review"];

/**
 * ISO-8601 instant with an explicit zone designator and up to microsecond
 * precision. An offset (or `Z`) is mandatory: a zone-less timestamp would be
 * ambiguous and must not be used as an ordering key.
 */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isFeedSource(value: unknown): value is FeedSource {
  return typeof value === "string" && FEED_SOURCES.includes(value);
}

/**
 * Encode a cursor from a (possibly incomplete) database row. Returns `null`
 * when any part is missing or malformed — the caller then reports the end of
 * the feed rather than emitting a cursor that cannot be honoured.
 */
export function encodeFeedCursor(input: FeedCursorInput): string | null {
  const createdAt = input.createdAt ?? "";
  const source = input.source ?? "";
  const id = input.id ?? "";

  if (!ISO_INSTANT.test(createdAt)) return null;
  if (!isFeedSource(source)) return null;
  if (!UUID.test(id)) return null;

  return `${CURSOR_VERSION}:${createdAt}:${source}:${id}`;
}

/**
 * Decode and validate an untrusted cursor. Returns `null` for a wrong
 * version, a malformed shape, a non-ISO timestamp, an unknown source, or a
 * malformed uuid — the caller must treat that as an invalid request and never
 * as "start from the beginning".
 */
export function decodeFeedCursor(raw: unknown): FeedCursor | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // The timestamp itself contains colons, so the fixed parts are taken from
  // the ends and everything between them is the timestamp.
  const parts = trimmed.split(":");
  if (parts.length < 5) return null;

  const [version] = parts;
  if (version !== CURSOR_VERSION) return null;

  const id = parts[parts.length - 1];
  const source = parts[parts.length - 2];
  const createdAt = parts.slice(1, parts.length - 2).join(":");

  if (!ISO_INSTANT.test(createdAt)) return null;
  if (!isFeedSource(source)) return null;
  if (!UUID.test(id)) return null;

  return { createdAt, source, id };
}
