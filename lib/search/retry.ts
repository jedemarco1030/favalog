/**
 * A small, testable retry policy for the embedding pipeline.
 *
 * Transient provider failures (network, 5xx, rate limits) are retried with
 * capped exponential backoff and optional jitter; fatal failures (missing/
 * rejected API key, i.e. `config` / `auth`) stop immediately and are re-thrown
 * so the pipeline can exit cleanly without hammering the provider. `sleep` and
 * `random` are injectable so tests are deterministic and instant.
 */

import {
  EmbeddingError,
  isFatalPipelineError,
  type EmbeddingErrorKind,
} from "./embedding-errors.ts";
import {
  PIPELINE_MAX_RETRIES,
  PIPELINE_RETRY_BASE_MS,
  PIPELINE_RETRY_MAX_MS,
} from "./config.ts";

/** Options controlling {@link withRetry}. All have sensible defaults. */
export interface RetryOptions {
  maxRetries?: number;
  baseMs?: number;
  maxMs?: number;
  /** Decide whether a thrown error is fatal (stop) vs retryable. */
  isFatal?: (error: unknown) => boolean;
  /** Injectable delay (defaults to a real timer). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable [0,1) source for jitter (defaults to Math.random). */
  random?: () => number;
  /** Called before each retry with the upcoming attempt + delay (for logging). */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    kind: EmbeddingErrorKind | "unknown";
  }) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Full-jitter capped exponential backoff for a given zero-based attempt index.
 * delay = random_in[0, min(maxMs, baseMs * 2^attempt)].
 */
export function computeBackoffMs(
  attempt: number,
  baseMs: number = PIPELINE_RETRY_BASE_MS,
  maxMs: number = PIPELINE_RETRY_MAX_MS,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(random() * exponential);
}

/** Default fatal check: `config` / `auth` embedding errors never retry. */
function defaultIsFatal(error: unknown): boolean {
  return error instanceof EmbeddingError && isFatalPipelineError(error);
}

/**
 * Run `fn`, retrying transient failures with capped exponential backoff.
 *
 * Re-throws immediately on a fatal error, and re-throws the last error once
 * retries are exhausted. Returns `fn`'s resolved value on success.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? PIPELINE_MAX_RETRIES;
  const baseMs = options.baseMs ?? PIPELINE_RETRY_BASE_MS;
  const maxMs = options.maxMs ?? PIPELINE_RETRY_MAX_MS;
  const isFatal = options.isFatal ?? defaultIsFatal;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (isFatal(error) || attempt === maxRetries) throw error;
      const delayMs = computeBackoffMs(attempt, baseMs, maxMs, random);
      options.onRetry?.({
        attempt: attempt + 1,
        delayMs,
        kind: error instanceof EmbeddingError ? error.kind : "unknown",
      });
      await sleep(delayMs);
    }
  }
  // Unreachable (loop either returns or throws), but satisfies the type checker.
  throw lastError;
}
