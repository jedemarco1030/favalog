import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@/lib/search/config";
import {
  DEFAULT_PROVIDER_ID,
  FakeEmbeddingProvider,
} from "@/lib/search/embedding-provider";

function sumOfSquares(vector: number[]): number {
  return vector.reduce((sum, value) => sum + value * value, 0);
}

describe("DEFAULT_PROVIDER_ID", () => {
  it("is openai", () => {
    expect(DEFAULT_PROVIDER_ID).toBe("openai");
  });
});

describe("FakeEmbeddingProvider", () => {
  it("has a stable fake id", () => {
    expect(new FakeEmbeddingProvider().id).toBe("fake");
  });

  it("defaults model and dimensions from config", () => {
    const provider = new FakeEmbeddingProvider();
    expect(provider.model).toBe(`fake-${EMBEDDING_MODEL}`);
    expect(provider.dimensions).toBe(EMBEDDING_DIMENSIONS);
  });

  it("allows overriding model and dimensions via the constructor", () => {
    const provider = new FakeEmbeddingProvider({
      model: "custom-model",
      dimensions: 8,
    });
    expect(provider.model).toBe("custom-model");
    expect(provider.dimensions).toBe(8);
  });

  it("returns one vector per input, in order, each of the right length", async () => {
    const provider = new FakeEmbeddingProvider({ dimensions: 16 });
    const response = await provider.embed(["alpha", "beta", "gamma"]);
    expect(response.vectors).toHaveLength(3);
    for (const vector of response.vectors) {
      expect(vector).toHaveLength(16);
    }
    expect(response.dimensions).toBe(16);
    expect(response.model).toBe(`fake-${EMBEDDING_MODEL}`);
  });

  it("produces L2-normalized vectors", async () => {
    const provider = new FakeEmbeddingProvider({ dimensions: 32 });
    const response = await provider.embed(["normalize me"]);
    expect(sumOfSquares(response.vectors[0])).toBeCloseTo(1, 6);
  });

  it("is deterministic: the same text yields an identical vector", async () => {
    const provider = new FakeEmbeddingProvider({ dimensions: 16 });
    const first = await provider.embed(["repeatable"]);
    const second = await provider.embed(["repeatable"]);
    expect(first.vectors[0]).toEqual(second.vectors[0]);
  });

  it("maps different text to different vectors", async () => {
    const provider = new FakeEmbeddingProvider({ dimensions: 16 });
    const response = await provider.embed(["one", "another"]);
    expect(response.vectors[0]).not.toEqual(response.vectors[1]);
  });

  it("reports a positive total token count", async () => {
    const provider = new FakeEmbeddingProvider();
    const response = await provider.embed(["some text to estimate"]);
    expect(response.usage?.totalTokens).toBeGreaterThan(0);
  });

  it("returns no vectors for an empty input array", async () => {
    const provider = new FakeEmbeddingProvider();
    const response = await provider.embed([]);
    expect(response.vectors).toEqual([]);
    expect(response.usage?.totalTokens).toBe(0);
  });
});
