import { APIError, APIUserAbortError } from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmbeddingError } from "@/lib/search/embedding-errors";
import {
  OpenAIEmbeddingProvider,
  createOpenAIEmbeddingProvider,
} from "@/lib/search/openai-embedding-provider";

// The captured mock for `client.embeddings.create`. `vi.mock` is hoisted, so
// the factory below must not close over module-scope bindings; the shared spy
// is exposed through the mocked module and re-read in each test.
const embeddingsCreate = vi.fn();

vi.mock("openai", async (importOriginal) => {
  // Keep the real error classes (APIError / APIUserAbortError) so the adapter's
  // `instanceof` checks behave exactly as in production; only the client is
  // faked so no network call is made and no real key is required.
  const actual = await importOriginal<typeof import("openai")>();
  class MockOpenAI {
    embeddings = { create: embeddingsCreate };
    constructor(_config: { apiKey: string }) {
      void _config;
    }
  }
  return {
    ...actual,
    default: MockOpenAI,
  };
});

/** Build an OpenAI SDK `APIError` for a given HTTP status. */
function makeApiError(status: number): APIError {
  return new APIError(status, undefined, "provider detail", new Headers());
}

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  embeddingsCreate.mockReset();
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

describe("OpenAIEmbeddingProvider.embed", () => {
  it("resolves vectors in input order even when response rows are shuffled by index", async () => {
    embeddingsCreate.mockResolvedValue({
      model: "text-embedding-3-small",
      data: [
        { index: 2, embedding: [0.3] },
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
      ],
      usage: { total_tokens: 7 },
    });

    const provider = new OpenAIEmbeddingProvider("sk-test");
    const response = await provider.embed(["a", "b", "c"]);

    expect(response.vectors).toEqual([[0.1], [0.2], [0.3]]);
    expect(response.usage?.totalTokens).toBe(7);
  });

  it("does not call the API for an empty input array and returns empty vectors", async () => {
    const provider = new OpenAIEmbeddingProvider("sk-test");
    const response = await provider.embed([]);

    expect(embeddingsCreate).not.toHaveBeenCalled();
    expect(response.vectors).toEqual([]);
  });

  it("passes the key only to the SDK client and never leaks it in errors", async () => {
    embeddingsCreate.mockRejectedValue(makeApiError(401));

    const provider = new OpenAIEmbeddingProvider("sk-super-secret");

    let thrown: unknown;
    try {
      await provider.embed(["a"]);
    } catch (error) {
      thrown = error;
    }

    // The request payload the adapter sends never contains the key.
    const [body] = embeddingsCreate.mock.calls[0] as [Record<string, unknown>];
    expect(JSON.stringify(body)).not.toContain("sk-super-secret");

    // The key is never present in the thrown error message.
    expect(thrown).toBeInstanceOf(EmbeddingError);
    expect((thrown as EmbeddingError).message).not.toContain("sk-super-secret");
  });

  it.each([
    [401, "auth"],
    [429, "rate_limit"],
    [500, "transient"],
    [400, "invalid"],
  ] as const)(
    "maps a %s response to an EmbeddingError of kind %s",
    async (status, kind) => {
      embeddingsCreate.mockRejectedValue(makeApiError(status));

      const provider = new OpenAIEmbeddingProvider("sk-test");
      await expect(provider.embed(["a"])).rejects.toMatchObject({ kind });
    },
  );

  it("wraps a network failure (statusless error) as a transient EmbeddingError", async () => {
    embeddingsCreate.mockRejectedValue(new TypeError("fetch failed"));

    const provider = new OpenAIEmbeddingProvider("sk-test");
    await expect(provider.embed(["a"])).rejects.toMatchObject({
      kind: "transient",
    });
  });

  it("rethrows an APIUserAbortError as-is (not wrapped)", async () => {
    const abort = new APIUserAbortError();
    embeddingsCreate.mockRejectedValue(abort);

    const provider = new OpenAIEmbeddingProvider("sk-test");
    await expect(provider.embed(["a"])).rejects.toBe(abort);
  });

  it("rethrows a raw AbortError as-is (not wrapped)", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    embeddingsCreate.mockRejectedValue(abort);

    const provider = new OpenAIEmbeddingProvider("sk-test");
    await expect(provider.embed(["a"])).rejects.toBe(abort);
  });
});

describe("createOpenAIEmbeddingProvider", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:true with a provider when the API key is set", () => {
    process.env.OPENAI_API_KEY = "sk-configured";
    const result = createOpenAIEmbeddingProvider();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.provider).toBeInstanceOf(OpenAIEmbeddingProvider);
  });

  it("returns ok:false with a config error when the API key is absent", () => {
    const result = createOpenAIEmbeddingProvider();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("config");
  });

  it("returns ok:false with a config error when the API key is blank", () => {
    process.env.OPENAI_API_KEY = "   ";
    const result = createOpenAIEmbeddingProvider();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.kind).toBe("config");
  });
});
