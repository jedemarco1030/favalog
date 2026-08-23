/**
 * The internal embedding-provider seam.
 *
 * A deliberately tiny interface so the rest of the system (pipeline, search
 * service, evaluation harness, tests) never depends on OpenAI directly. Tests
 * use {@link FakeEmbeddingProvider} (deterministic, no network, no key); the
 * live path uses the server-only OpenAI adapter. Swapping providers is a matter
 * of implementing this interface — no orchestration framework is introduced for
 * a single embedding call.
 */

import { createHash } from "node:crypto";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER_ID,
} from "./config.ts";

/** The result of embedding one or more input texts. */
export interface EmbeddingResponse {
  /** The model identity the provider actually used (echoed back). */
  model: string;
  /** The dimensionality of the returned vectors. */
  dimensions: number;
  /** One unit-length vector per input text, in input order. */
  vectors: number[][];
  /** Token usage when the provider reports it (never required). */
  usage?: { totalTokens?: number };
}

/** Per-call options; an `AbortSignal` lets callers enforce a strict timeout. */
export interface EmbedOptions {
  signal?: AbortSignal;
}

/**
 * A provider that turns text into embedding vectors. Implementations must return
 * exactly one vector per input, in order, each of {@link dimensions} length.
 */
export interface EmbeddingProvider {
  /** Stable provider id recorded on rows (e.g. `openai`, `fake`). */
  readonly id: string;
  /** The model identity (recorded on rows and used to detect model drift). */
  readonly model: string;
  /** The embedding dimensionality this provider produces. */
  readonly dimensions: number;
  /** Embed a batch of texts. Throws an `EmbeddingError` on failure. */
  embed(texts: string[], options?: EmbedOptions): Promise<EmbeddingResponse>;
}

/**
 * A deterministic, offline embedding provider for tests and the secret-free
 * evaluation baseline.
 *
 * Vectors are derived from a SHA-256 hash of the input text seeding a small
 * xorshift PRNG, then L2-normalized. The mapping is a pure function of the text
 * (and the configured dimensions), so the same text always yields the same unit
 * vector across processes — enough for deterministic tests of the pipeline and
 * search plumbing. It makes no network calls and needs no API key.
 *
 * NOTE: these vectors are deterministic, not semantically meaningful. The
 * offline evaluation "semantic" quality is therefore measured with committed
 * fixture rankings, not fake-vector cosine similarity.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly id = "fake";
  readonly model: string;
  readonly dimensions: number;

  constructor(options: { model?: string; dimensions?: number } = {}) {
    this.model = options.model ?? `fake-${EMBEDDING_MODEL}`;
    this.dimensions = options.dimensions ?? EMBEDDING_DIMENSIONS;
  }

  async embed(texts: string[]): Promise<EmbeddingResponse> {
    const vectors = texts.map((text) => this.vectorFor(text));
    // A stable, deterministic token estimate (roughly 4 chars/token).
    const totalTokens = texts.reduce(
      (sum, text) => sum + Math.ceil(text.length / 4),
      0,
    );
    return {
      model: this.model,
      dimensions: this.dimensions,
      vectors,
      usage: { totalTokens },
    };
  }

  /** Deterministic unit vector for a single text. */
  private vectorFor(text: string): number[] {
    const seedHex = createHash("sha256").update(text, "utf8").digest("hex");
    // Seed a 128-bit state from the digest.
    let s0 = parseInt(seedHex.slice(0, 8), 16) >>> 0;
    let s1 = parseInt(seedHex.slice(8, 16), 16) >>> 0;
    let s2 = parseInt(seedHex.slice(16, 24), 16) >>> 0;
    let s3 = parseInt(seedHex.slice(24, 32), 16) >>> 0;

    // xorshift128 — small, fast, deterministic. Not for cryptography.
    const next = (): number => {
      let t = s3;
      const s = s0;
      s3 = s2;
      s2 = s1;
      s1 = s;
      t ^= t << 11;
      t ^= t >>> 8;
      s0 = (t ^ s ^ (s >>> 19)) >>> 0;
      return s0 / 0xffffffff;
    };

    const vector = new Array<number>(this.dimensions);
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      const value = next() * 2 - 1; // centre on 0
      vector[i] = value;
      norm += value * value;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.dimensions; i++) vector[i] /= norm;
    return vector;
  }
}

/** The default provider id, exported for callers that record provenance. */
export const DEFAULT_PROVIDER_ID = EMBEDDING_PROVIDER_ID;
