/**
 * Safe provider error model.
 *
 * External-provider failures are mapped into a SMALL, closed set of categories
 * so the rest of the app can reason about retryability and degradation without
 * ever seeing a raw provider payload, status body, URL, or credential. A
 * {@link CatalogProviderError} carries only safe, structured fields; its
 * message is a controlled, secret-free string.
 *
 * This module performs no I/O and reads no secret; it is safe to import
 * anywhere.
 */

import type { ExternalProvider } from "./types";

/**
 * The closed set of provider failure categories.
 *
 * Retryability is a property of the category, centralized in
 * {@link isRetryableCategory} so every caller agrees:
 *   - `rate_limited` (429) and `unavailable` (5xx / network) and `timeout`
 *     (aborted) are transient → retryable with backoff.
 *   - `unauthorized`, `validation`, `not_found`, and `not_configured` are
 *     terminal → never retried (retrying a bad token or a real 404 only wastes
 *     the provider's quota and our latency budget).
 *   - `unknown` is treated as terminal (not retried) so an unclassified error
 *     never loops.
 */
export type ProviderErrorCategory =
  | "unauthorized"
  | "validation"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "not_configured"
  | "unknown";

/** The categories that represent transient failures worth retrying. */
const RETRYABLE: ReadonlySet<ProviderErrorCategory> = new Set([
  "rate_limited",
  "unavailable",
  "timeout",
]);

/** Whether a category is a transient failure eligible for a bounded retry. */
export function isRetryableCategory(category: ProviderErrorCategory): boolean {
  return RETRYABLE.has(category);
}

/** Structured, secret-free fields carried by a {@link CatalogProviderError}. */
export interface CatalogProviderErrorFields {
  provider: ExternalProvider;
  /** The logical operation that failed, e.g. `search` or `getByExternalId`. */
  operation: string;
  category: ProviderErrorCategory;
  /**
   * Server-advised delay before retrying, in milliseconds, parsed from a
   * `Retry-After` header when present. Undefined when not supplied.
   */
  retryAfterMs?: number;
  /**
   * The upstream HTTP status, retained ONLY as a number for logging/telemetry.
   * Never the response body. Undefined for non-HTTP failures (abort, network).
   */
  status?: number;
}

/**
 * A provider failure with a safe, structured shape.
 *
 * Construct it via {@link providerError} or the HTTP mappers rather than `new`
 * directly so category/retryability stay consistent. The `message` is always a
 * controlled string that MUST NOT contain a URL, query text, token, or raw
 * provider payload.
 */
export class CatalogProviderError extends Error {
  readonly provider: ExternalProvider;
  readonly operation: string;
  readonly category: ProviderErrorCategory;
  readonly retryAfterMs?: number;
  readonly status?: number;

  constructor(message: string, fields: CatalogProviderErrorFields) {
    super(message);
    this.name = "CatalogProviderError";
    this.provider = fields.provider;
    this.operation = fields.operation;
    this.category = fields.category;
    this.retryAfterMs = fields.retryAfterMs;
    this.status = fields.status;
  }

  /** Whether this failure is transient and eligible for a bounded retry. */
  get retryable(): boolean {
    return isRetryableCategory(this.category);
  }
}

/** Construct a {@link CatalogProviderError} with a safe, category-derived message. */
export function providerError(
  fields: CatalogProviderErrorFields,
  message?: string,
): CatalogProviderError {
  return new CatalogProviderError(
    message ??
      safeMessageFor(fields.category, fields.provider, fields.operation),
    fields,
  );
}

/**
 * A controlled, human-readable message for a category. Contains only the
 * provider id, the operation name, and the category — never dynamic upstream
 * content — so it is always safe to log or surface.
 */
export function safeMessageFor(
  category: ProviderErrorCategory,
  provider: ExternalProvider,
  operation: string,
): string {
  const reason: Record<ProviderErrorCategory, string> = {
    unauthorized: "provider rejected the credentials",
    validation: "the request was invalid",
    not_found: "the requested item was not found",
    rate_limited: "the provider rate-limited the request",
    unavailable: "the provider is temporarily unavailable",
    timeout: "the request timed out",
    not_configured: "the provider is not configured",
    unknown: "an unexpected provider error occurred",
  };
  return `[${provider}] ${operation} failed: ${reason[category]}`;
}

/**
 * Map an HTTP status to a provider error category. Encodes the retry policy:
 *   - 401/403 → `unauthorized` (terminal)
 *   - 404      → `not_found` (terminal)
 *   - 400/422 → `validation` (terminal)
 *   - 429      → `rate_limited` (retryable)
 *   - 5xx      → `unavailable` (retryable)
 *   - anything else → `unknown` (terminal)
 */
export function categoryForStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500 && status <= 599) return "unavailable";
  return "unknown";
}
