"use client";

/**
 * Root Vercel Web Analytics integration with query redaction.
 *
 * This thin client wrapper renders the standard `<Analytics>` component and
 * wires {@link redactAnalyticsUrl} into its `beforeSend` hook so the shareable
 * `?q=` query parameter is stripped from EVERY analytics event URL — page views
 * and custom events alike — before transmission. If a URL cannot be parsed the
 * sanitizer fails closed and the event is dropped.
 *
 * This only affects Favalog's own analytics telemetry. It does not control
 * Vercel Runtime Logs or any other request-log search-parameter handling and
 * retention, which remain platform/owner concerns.
 */

import { Analytics } from "@vercel/analytics/next";

import { redactAnalyticsUrl } from "@/lib/analytics/redact-analytics-url";

export function AnalyticsWithRedaction() {
  return <Analytics beforeSend={redactAnalyticsUrl} />;
}
