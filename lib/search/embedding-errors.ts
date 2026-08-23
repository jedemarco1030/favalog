/**
 * Error taxonomy and safe mapping for the embedding provider boundary.
 *
 * Provider failures are classified into a small, stable set of *kinds* so the
 * pipeline and the search service can react correctly:
 *
 *   - `config` / `auth`  → STOP. Do not retry; the run cannot succeed. (Missing
 *                          or rejected API key.)
 *   - `rate_limit`       → retry with backoff (transient by capacity).
 *   - `transient`        → retry with backoff (network / 5xx / timeout).
 *   - `invalid`          → do not retry; the request itself is malformed.
 *   - `unknown`          → treated conservatively as non-retryable.
 *
 * Crucially, {@link toSafeErrorCategory} produces only a coarse, non-sensitive
 * label suitable for structured logs and UI state. Raw provider messages, the
 * API key, request bodies, and responses never travel through it.
 */

/** The stable classification of an embedding failure. */
export type EmbeddingErrorKind =
  "config" | "auth" | "rate_limit" | "transient" | "invalid" | "unknown";

/**
 * A classified embedding error. The `message` is intentionally generic and safe
 * to surface; it never contains the API key, the query text, or raw provider
 * output. `retryable` drives the pipeline's backoff decision.
 */
export class EmbeddingError extends Error {
  readonly kind: EmbeddingErrorKind;
  readonly retryable: boolean;
  /** HTTP status, when the failure originated from an HTTP response. */
  readonly status?: number;

  constructor(
    kind: EmbeddingErrorKind,
    message: string,
    options?: { retryable?: boolean; status?: number },
  ) {
    super(message);
    this.name = "EmbeddingError";
    this.kind = kind;
    this.status = options?.status;
    this.retryable =
      options?.retryable ?? (kind === "rate_limit" || kind === "transient");
  }
}

/** Map an HTTP status code from the provider to an {@link EmbeddingErrorKind}. */
export function classifyHttpStatus(status: number): EmbeddingErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 404 || status === 422) return "invalid";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "transient";
  return "unknown";
}

/** Build an {@link EmbeddingError} from an HTTP status with a safe message. */
export function embeddingErrorFromStatus(status: number): EmbeddingError {
  const kind = classifyHttpStatus(status);
  return new EmbeddingError(kind, `embedding request failed (${kind})`, {
    status,
  });
}

/** Whether a classified error should stop a batch pipeline immediately. */
export function isFatalPipelineError(error: EmbeddingError): boolean {
  return error.kind === "config" || error.kind === "auth";
}

/**
 * Reduce any thrown value to a coarse, non-sensitive category safe to log or
 * store. Unwraps {@link EmbeddingError} kinds; classifies common network/abort
 * failures as transient; everything else is `unknown`. Never returns raw text
 * from the underlying error.
 */
export function toSafeErrorCategory(error: unknown): EmbeddingErrorKind {
  if (error instanceof EmbeddingError) return error.kind;
  if (error instanceof Error) {
    // AbortController timeout surfaces as an AbortError / TimeoutError.
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return "transient";
    }
    // Node fetch network failures.
    if (error.name === "TypeError" && /fetch/i.test(error.message)) {
      return "transient";
    }
  }
  return "unknown";
}
