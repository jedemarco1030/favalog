/**
 * Query-parameter redaction for Vercel Web Analytics event URLs.
 *
 * Explore intentionally uses a shareable `?q=` URL, so the raw query lives in
 * the address bar (and therefore in browser history and any hosting/request
 * logs the platform keeps). This module keeps Favalog's own analytics telemetry
 * query-free: it strips the `q` search parameter from the URL that Vercel Web
 * Analytics would otherwise transmit for page-view and custom events.
 *
 * It does NOT — and cannot — control Vercel Runtime Logs or any request-log
 * search-parameter handling; those remain platform/owner concerns governed by
 * the hosting configuration and retention policy.
 *
 * {@link redactAnalyticsUrl} is a pure function (easy to unit-test); the client
 * `<AnalyticsWithRedaction>` wrapper wires it into the root `<Analytics>`
 * `beforeSend` hook so it applies to every event.
 */

import type { BeforeSendEvent } from "@vercel/analytics/next";

/** The single search parameter carrying the raw user query. */
export const REDACTED_QUERY_PARAM = "q" as const;

/**
 * Return the analytics event with the `q` search parameter removed from its
 * URL, preserving every other part of the URL (origin, path, hash, and all
 * other query parameters).
 *
 * FAIL CLOSED: if the URL cannot be parsed, return `null` to DROP the event
 * rather than transmit an unsanitized URL that might still carry the query.
 * Analytics is best-effort, so dropping an event never affects the user.
 */
export function redactAnalyticsUrl(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    url.searchParams.delete(REDACTED_QUERY_PARAM);
    return { ...event, url: url.toString() };
  } catch {
    // Unparseable URL: never send it unsanitized.
    return null;
  }
}
