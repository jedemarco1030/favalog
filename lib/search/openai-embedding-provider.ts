/**
 * Server-only OpenAI embedding adapter.
 *
 * Implements {@link EmbeddingProvider} against the OpenAI embeddings API using
 * the official `openai` SDK (a single `embeddings.create` call) — no
 * orchestration framework. Because the whole system talks to the
 * {@link EmbeddingProvider} seam, swapping to another provider later remains a
 * localized change.
 *
 * SECURITY: this module must only ever run on the server. The API key is read
 * from `process.env.OPENAI_API_KEY` at call sites (see {@link createOpenAIEmbeddingProvider})
 * and passed only to the SDK client. It is never logged, never placed in an
 * error message, and never returned. On any provider error the raw body/message
 * is discarded and a classified {@link EmbeddingError} with a generic message is
 * thrown (or an abort error is re-thrown as-is for the caller's timeout path).
 */

import OpenAI, { APIError, APIUserAbortError } from "openai";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER_ID,
} from "./config.ts";
import {
  EmbeddingError,
  embeddingErrorFromStatus,
} from "./embedding-errors.ts";
import type {
  EmbedOptions,
  EmbeddingProvider,
  EmbeddingResponse,
} from "./embedding-provider";

/** The subset of the OpenAI embeddings response we rely on. */
interface OpenAIEmbeddingApiResponse {
  model?: string;
  data?: Array<{ embedding?: number[]; index?: number }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

/**
 * Whether a thrown value represents an aborted request (the caller's strict
 * timeout firing). The SDK surfaces this as an {@link APIUserAbortError}; a raw
 * `AbortError` (name-based) is also honoured for robustness.
 */
function isAbortError(error: unknown): boolean {
  return (
    error instanceof APIUserAbortError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * The OpenAI-backed provider. Construct it via
 * {@link createOpenAIEmbeddingProvider} so the missing-key case is handled as a
 * controlled `config` error rather than an unguarded throw.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = EMBEDDING_PROVIDER_ID;
  readonly model: string;
  readonly dimensions: number;
  readonly #client: OpenAI;

  constructor(
    apiKey: string,
    options?: { model?: string; dimensions?: number },
  ) {
    // The key lives only inside the SDK client; it is never stored on `this`
    // in a readable field, logged, or surfaced in an error.
    this.#client = new OpenAI({ apiKey });
    this.model = options?.model ?? EMBEDDING_MODEL;
    this.dimensions = options?.dimensions ?? EMBEDDING_DIMENSIONS;
  }

  async embed(
    texts: string[],
    options?: EmbedOptions,
  ): Promise<EmbeddingResponse> {
    if (texts.length === 0) {
      return { model: this.model, dimensions: this.dimensions, vectors: [] };
    }

    let payload: OpenAIEmbeddingApiResponse;
    try {
      payload = (await this.#client.embeddings.create(
        {
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
          encoding_format: "float",
        },
        { signal: options?.signal },
      )) as OpenAIEmbeddingApiResponse;
    } catch (error) {
      // Aborted (timeout): re-throw as-is so the caller's timeout handling can
      // see it. Everything else is discarded (no provider detail leaks) and
      // classified: an HTTP status maps by kind, a statusless error (network /
      // connection failure) is transient.
      if (isAbortError(error)) throw error;
      if (error instanceof APIError && typeof error.status === "number") {
        throw embeddingErrorFromStatus(error.status);
      }
      throw new EmbeddingError(
        "transient",
        "embedding request failed (network)",
      );
    }

    const data = payload.data;
    if (!Array.isArray(data) || data.length !== texts.length) {
      throw new EmbeddingError(
        "unknown",
        "embedding response shape did not match the request",
      );
    }

    // Preserve input order (OpenAI returns an `index` per row).
    const vectors = new Array<number[]>(texts.length);
    for (const row of data) {
      const index = typeof row.index === "number" ? row.index : -1;
      if (index < 0 || index >= texts.length || !Array.isArray(row.embedding)) {
        throw new EmbeddingError(
          "unknown",
          "embedding response contained a malformed row",
        );
      }
      vectors[index] = row.embedding;
    }

    return {
      model: payload.model ?? this.model,
      dimensions: this.dimensions,
      vectors,
      usage: { totalTokens: payload.usage?.total_tokens },
    };
  }
}

/**
 * Build the OpenAI provider from the environment, or return a controlled
 * `config` error when `OPENAI_API_KEY` is absent. Callers (search service,
 * pipeline) branch on this instead of throwing, so a missing key degrades
 * gracefully to keyword-only search and stops the pipeline cleanly.
 */
export function createOpenAIEmbeddingProvider():
  | { ok: true; provider: OpenAIEmbeddingProvider }
  | { ok: false; error: EmbeddingError } {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: new EmbeddingError("config", "OPENAI_API_KEY is not configured", {
        retryable: false,
      }),
    };
  }
  return { ok: true, provider: new OpenAIEmbeddingProvider(apiKey) };
}
