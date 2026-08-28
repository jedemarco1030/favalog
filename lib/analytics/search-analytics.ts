/**
 * Aggregate, privacy-preserving PRODUCT analytics for Explore search.
 *
 * This is deliberately SEPARATE from the server operational telemetry in
 * `lib/search/log.ts`:
 *
 *   - Operational telemetry (server logs) answers "is search healthy?" — mode,
 *     latency, tokens, errors — for OPERATORS.
 *   - These aggregate product signals answer "are users finding and selecting
 *     results?" — coarse, anonymized behaviour — for PRODUCT insight, via
 *     Vercel Web Analytics.
 *
 * ONLY coarse, low-cardinality properties are ever emitted: retrieval mode, the
 * allow-listed media filter, result kind, a zero-result flag, and BUCKETED
 * result-count / rank. The raw query, media title/slug, request/correlation id,
 * user identity, and any other high-cardinality or personal data are NEVER
 * sent. Nested objects are not supported by Vercel Analytics and never used.
 *
 * The `track` implementation is dependency-injected (default: `@vercel/analytics`)
 * so unit tests never require Vercel, and every emit is wrapped so that an
 * analytics failure — or analytics being blocked/unavailable — can NEVER affect
 * navigation or search.
 */

import { track as vercelTrack } from "@vercel/analytics";

import type { SearchKindFilter, SearchMode } from "@/lib/search/config";
import type { MediaKind } from "@/lib/types";

/** Coarse property values Vercel Analytics accepts (never nested). */
export type AnalyticsValue = string | number | boolean;

/** The minimal `track` seam. Matches `@vercel/analytics`'s `track`. */
export type TrackFn = (
  name: string,
  properties?: Record<string, AnalyticsValue>,
) => void;

/** A built analytics event: a fixed name plus coarse, allow-listed properties. */
export interface AnalyticsEvent {
  name: string;
  properties: Record<string, AnalyticsValue>;
}

/** Fixed event names (stable, low-cardinality). */
export const EXPLORE_SEARCH_EVENT = "explore_search" as const;
export const EXPLORE_RESULT_SELECTED_EVENT = "explore_result_selected" as const;

/**
 * Bucket a result count into a small, fixed set of ranges so no exact,
 * potentially-identifying count is emitted.
 */
export function resultCountBucket(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count <= 3) return "1-3";
  if (count <= 10) return "4-10";
  return "11+";
}

/**
 * Bucket a zero-based result index into a coarse RANK band (1-based ranks) so a
 * precise position is never emitted.
 */
export function rankBucket(index: number): string {
  if (!Number.isFinite(index) || index < 0) return "unknown";
  const rank = Math.floor(index) + 1;
  if (rank === 1) return "1";
  if (rank <= 3) return "2-3";
  if (rank <= 10) return "4-10";
  return "11+";
}

/** Input for the "an Explore search outcome was rendered" event. */
export interface SearchOutcomeAnalytics {
  mode: SearchMode;
  filter: SearchKindFilter;
  zeroResult: boolean;
  resultCount: number;
}

/** Input for the "a user selected a result" event. */
export interface ResultSelectedAnalytics {
  mode: SearchMode;
  filter: SearchKindFilter;
  resultKind: MediaKind;
  /** Zero-based index of the selected result within the rendered list. */
  index: number;
}

/**
 * Build the coarse, allow-listed properties for a rendered search outcome.
 * Pure and side-effect-free so tests can assert the exact property shape.
 */
export function buildSearchOutcomeEvent(
  input: SearchOutcomeAnalytics,
): AnalyticsEvent {
  return {
    name: EXPLORE_SEARCH_EVENT,
    properties: {
      mode: input.mode,
      filter: input.filter,
      zeroResult: input.zeroResult,
      resultCountBucket: resultCountBucket(input.resultCount),
    },
  };
}

/** Build the coarse, allow-listed properties for a selected result. */
export function buildResultSelectedEvent(
  input: ResultSelectedAnalytics,
): AnalyticsEvent {
  return {
    name: EXPLORE_RESULT_SELECTED_EVENT,
    properties: {
      mode: input.mode,
      filter: input.filter,
      resultKind: input.resultKind,
      rankBucket: rankBucket(input.index),
    },
  };
}

/**
 * Emit an event through the injected `track`, swallowing ANY error so analytics
 * can never interfere with navigation or search. Never throws.
 */
function safeTrack(event: AnalyticsEvent, track: TrackFn): void {
  try {
    track(event.name, event.properties);
  } catch {
    /* analytics is best-effort; a failure must never affect the user */
  }
}

/** Emit the "search outcome rendered" aggregate event. Never throws. */
export function trackSearchOutcome(
  input: SearchOutcomeAnalytics,
  track: TrackFn = vercelTrack,
): void {
  safeTrack(buildSearchOutcomeEvent(input), track);
}

/** Emit the "result selected" aggregate event. Never throws. */
export function trackResultSelected(
  input: ResultSelectedAnalytics,
  track: TrackFn = vercelTrack,
): void {
  safeTrack(buildResultSelectedEvent(input), track);
}
