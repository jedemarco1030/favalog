/**
 * Bounded, reliable JSON fetch for external providers.
 *
 * A single helper wraps every provider HTTP call with the whole reliability
 * policy so an adapter never re-implements it:
 *   - a hard per-request timeout (via an abort signal),
 *   - the caller's external abort signal (linked, so a cancelled request
 *     aborts too),
 *   - the bounded retry/backoff policy honouring `Retry-After`,
 *   - mapping every failure into a safe {@link CatalogProviderError} — never a
 *     raw network error, URL, or response body escapes.
 *
 * The `fetch` implementation is injectable so tests run with no network. This
 * module is server-only in practice (it reads no secret itself, but is only
 * ever called by server-only adapters); it must never be imported by a client
 * component.
 */

import { REQUEST_TIMEOUT_MS } from "./config.ts";
import {
  categoryForStatus,
  CatalogProviderError,
  providerError,
} from "./errors.ts";
import {
  parseRetryAfterMs,
  withRetry,
  type RetryEnvironment,
} from "./reliability.ts";
import type { ExternalProvider } from "./types";

/** A fetch-compatible function that also accepts the framework cache hint. */
export type FetchLike = (
  input: string,
  init?: RequestInit & { next?: { revalidate?: number } },
) => Promise<Response>;

/** Options for {@link fetchProviderJson}. */
export interface FetchProviderJsonOptions {
  provider: ExternalProvider;
  /** Logical operation name for error attribution (e.g. `search`). */
  operation: string;
  url: string;
  headers?: Record<string, string>;
  /** Per-request timeout; defaults to {@link REQUEST_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Framework cache TTL (seconds); when set, passed as `next.revalidate`. */
  cacheTtlSeconds?: number;
  /** Caller abort signal; linked with the internal timeout. */
  signal?: AbortSignal;
  /** Injected fetch (defaults to global `fetch`). */
  fetchImpl?: FetchLike;
  /** Injected retry environment (defaults to real timers + Math.random). */
  retryEnv?: RetryEnvironment;
}

/** A successful JSON fetch plus how many retries it took. */
export interface FetchProviderJsonResult<T> {
  data: T;
  retries: number;
}

/**
 * Perform ONE attempt: link the timeout + caller signals, fetch, and map any
 * failure into a {@link CatalogProviderError}. Retryable categories bubble up so
 * {@link withRetry} can decide; terminal ones stop immediately.
 */
async function attemptFetch<T>(
  options: FetchProviderJsonOptions,
  fetchImpl: FetchLike,
): Promise<T> {
  const { provider, operation } = options;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([timeoutSignal, options.signal])
    : timeoutSignal;

  let response: Response;
  try {
    const init: RequestInit & { next?: { revalidate?: number } } = {
      method: "GET",
      headers: { Accept: "application/json", ...options.headers },
      signal,
    };
    if (options.cacheTtlSeconds !== undefined) {
      init.next = { revalidate: options.cacheTtlSeconds };
    }
    response = await fetchImpl(options.url, init);
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    const callerAborted = options.signal?.aborted === true;
    if (aborted && callerAborted) {
      // The caller cancelled deliberately. This is TERMINAL: rethrow the
      // original abort so the retry policy (which retries `timeout`) does not
      // loop on an already-aborted signal. No upstream data is exposed.
      throw error;
    }
    // Our own request timeout → `timeout` (retryable); any other network
    // failure → `unavailable` (retryable). No URL/body is ever included.
    throw providerError({
      provider,
      operation,
      category: aborted ? "timeout" : "unavailable",
    });
  }

  if (!response.ok) {
    const category = categoryForStatus(response.status);
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    throw providerError({
      provider,
      operation,
      category,
      status: response.status,
      retryAfterMs,
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    // A 2xx with an unparseable body is an upstream problem, not ours; treat as
    // unavailable so a transient garbled response can be retried once.
    throw providerError({ provider, operation, category: "unavailable" });
  }
}

/**
 * Fetch and parse provider JSON with the full reliability policy. Returns the
 * parsed body and the number of retries performed, or throws a
 * {@link CatalogProviderError}.
 */
export async function fetchProviderJson<T>(
  options: FetchProviderJsonOptions,
): Promise<FetchProviderJsonResult<T>> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  if (typeof fetchImpl !== "function") {
    throw providerError({
      provider: options.provider,
      operation: options.operation,
      category: "unavailable",
    });
  }

  let retries = 0;
  const data = await withRetry<T>(async (attempt) => {
    retries = attempt - 1;
    return attemptFetch<T>(options, fetchImpl);
  }, options.retryEnv);

  return { data, retries };
}

export { CatalogProviderError };
