/**
 * Server-only OpenAI embedding adapter.
 *
 * Implements {@link EmbeddingProvider} against the OpenAI embeddings REST API
 * directly (a single POST) — no orchestration framework and no SDK dependency,
 * which keeps secret-free / offline builds dependency-free. Because the whole
 * system talks to the {@link EmbeddingProvider} seam, swapping to the official
 * SDK or another provider later is a localized change.
 *
 * SECURITY: this module must only ever run on the server. The API key is read
 * from `process.env.OPENAI_API_KEY` at call sites (see {@link createOpenAIEmbeddingProvider})
 * and is sent ONLY in the Authorization header. It is never logged, never placed
 * in an error message, and never returned. On any non-2xx response the body is
 * discarded and a classified {@link EmbeddingError} with a generic message is
 * thrown.
 */

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

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

/** The subset of the OpenAI embeddings response we rely on. */
interface OpenAIEmbeddingApiResponse {
  model?: string;
  data?: Array<{ embedding?: number[]; index?: number }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
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
  readonly #apiKey: string;

  constructor(
    apiKey: string,
    options?: { model?: string; dimensions?: number },
  ) {
    this.#apiKey = apiKey;
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

    let response: Response;
    try {
      response = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.#apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
          encoding_format: "float",
        }),
        signal: options?.signal,
      });
    } catch (error) {
      // Network failure or aborted (timeout). Re-throw AbortError as-is so the
      // caller's timeout handling can see it; wrap everything else as transient.
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new EmbeddingError(
        "transient",
        "embedding request failed (network)",
      );
    }

    if (!response.ok) {
      // Discard the body so no provider detail leaks; classify by status only.
      throw embeddingErrorFromStatus(response.status);
    }

    let payload: OpenAIEmbeddingApiResponse;
    try {
      payload = (await response.json()) as OpenAIEmbeddingApiResponse;
    } catch {
      throw new EmbeddingError(
        "transient",
        "embedding response was not valid JSON",
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
