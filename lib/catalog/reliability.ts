/**
 * Responsible retry + backoff for external-provider calls.
 *
 * Policy (see ADR 0004):
 *   - Only transient failures are retried: `rate_limited` (429), `unavailable`
 *     (5xx / network), and `timeout` (abort). `unauthorized`, `validation`,
 *     `not_found`, `not_configured`, and `unknown` are terminal and returned
 *     immediately — retrying them wastes quota and latency.
 *   - Backoff is capped exponential with full jitter, ceilinged by
 *     {@link RETRY_MAX_MS}.
 *   - A server-supplied `Retry-After` (surfaced as `retryAfterMs` on the error)
 *     takes precedence over computed backoff but is itself capped by
 *     {@link RETRY_AFTER_MAX_MS} so a hostile value cannot stall us.
 *   - The total number of ATTEMPTS is bounded by {@link MAX_ATTEMPTS}.
 *
 * The delay computation is a pure function so it is fully unit-testable; the
 * sleep source and randomness are injectable.
 */

import {
  MAX_ATTEMPTS,
  RETRY_AFTER_MAX_MS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
} from "./config.ts";
import { CatalogProviderError } from "./errors.ts";

/** Injectable clock/random so retries are deterministic under test. */
export interface RetryEnvironment {
  /** Resolve after `ms` milliseconds. */
  sleep: (ms: number) => Promise<void>;
  /** Return a value in [0, 1). Defaults to `Math.random`. */
  random?: () => number;
}

const defaultEnvironment: RetryEnvironment = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
};

/**
 * Compute the delay before the NEXT attempt.
 *
 * @param attempt      1-based index of the attempt that just failed.
 * @param retryAfterMs server-advised delay (already parsed), if any.
 * @param random       source of jitter in [0, 1).
 */
export function computeBackoffMs(
  attempt: number,
  retryAfterMs: number | undefined,
  random: () => number,
): number {
  // A server-advised delay wins, but is capped so it can never stall us long.
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return Math.min(retryAfterMs, RETRY_AFTER_MAX_MS);
  }
  // Capped exponential backoff with FULL jitter: uniform in [0, cappedBase].
  const exponential = RETRY_BASE_MS * 2 ** (attempt - 1);
  const capped = Math.min(exponential, RETRY_MAX_MS);
  return Math.round(capped * random());
}

/**
 * Run `operation` with the bounded retry policy. `operation` must throw a
 * {@link CatalogProviderError} on failure (the adapters guarantee this). Any
 * other thrown value is treated as terminal and rethrown as-is, since we cannot
 * reason about its retryability.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  environment: RetryEnvironment = defaultEnvironment,
): Promise<T> {
  const random = environment.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const isLast = attempt >= MAX_ATTEMPTS;
      if (
        !(error instanceof CatalogProviderError) ||
        !error.retryable ||
        isLast
      ) {
        throw error;
      }
      const delay = computeBackoffMs(attempt, error.retryAfterMs, random);
      if (delay > 0) await environment.sleep(delay);
    }
  }

  // Unreachable in practice (the loop either returns or throws), but keeps the
  // type checker satisfied and fails loudly if the invariants ever change.
  throw lastError;
}

/**
 * Parse a `Retry-After` header value into milliseconds.
 *
 * Supports both forms in the spec: a delta-seconds integer (e.g. `120`) and an
 * HTTP-date (e.g. `Wed, 21 Oct 2026 07:28:00 GMT`), the latter measured from
 * `now`. Returns `undefined` for a missing/blank/invalid/negative value. The
 * result is NOT capped here (the cap is applied in {@link computeBackoffMs}) so
 * the raw advice is preserved for logging.
 */
export function parseRetryAfterMs(
  headerValue: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (headerValue === null || headerValue === undefined) return undefined;
  const trimmed = headerValue.trim();
  if (trimmed === "") return undefined;

  // delta-seconds form.
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return undefined;
    return seconds * 1000;
  }

  // HTTP-date form.
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  const delta = dateMs - now;
  return delta > 0 ? delta : 0;
}
