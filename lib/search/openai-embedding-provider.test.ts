import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmbeddingError } from "@/lib/search/embedding-errors";
import {
  OpenAIEmbeddingProvider,
  createOpenAIEmbeddingProvider,
} from "@/lib/search/openai-embedding-provider";

/** Build a minimal fetch Response stand-in with a JSON payload. */
function makeResponse(ok: boolean, status: number, payload: unknown): Response {
  return {
    ok,
    status,
    json: async () => payload,
  } as unknown as Response;
}

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

describe("OpenAIEmbeddingProvider.embed", () => {
  it("resolves vectors in input order even when response rows are shuffled by index", async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse(true, 200, {
        model: "text-embedding-3-small",
        data: [
          { index: 2, embedding: [0.3] },
          { index: 0, embedding: [0.1] },
          { index: 1, embedding: [0.2] },
        ],
        usage: { total_tokens: 7 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIEmbeddingProvider("sk-test");
    const response = await provider.embed(["a", "b", "c"]);

    expect(response.vectors).toEqual([[0.1], [0.2], [0.3]]);
    expect(response.usage?.totalTokens).toBe(7);
  });

  it("does not call fetch for an empty input array and returns empty vectors", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIEmbeddingProvider("sk-test");
    const response = await provider.embed([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.vectors).toEqual([]);
  });

  it("sends the API key only in the Authorization header and never leaks it in errors", async () => {
    const fetchMock = vi.fn(async () => makeResponse(false, 401, {}));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIEmbeddingProvider("sk-super-secret");

    let thrown: unknown;
    try {
      await provider.embed(["a"]);
    } catch (error) {
      thrown = error;
    }

    // The Authorization header carries `Bearer <key>`.
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-super-secret");

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
      const fetchMock = vi.fn(async () => makeResponse(false, status, {}));
      vi.stubGlobal("fetch", fetchMock);

      const provider = new OpenAIEmbeddingProvider("sk-test");
      await expect(provider.embed(["a"])).rejects.toMatchObject({ kind });
    },
  );

  it("wraps a rejected fetch (network failure) as a transient EmbeddingError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIEmbeddingProvider("sk-test");
    await expect(provider.embed(["a"])).rejects.toMatchObject({
      kind: "transient",
    });
  });

  it("rethrows an AbortError as-is (not wrapped)", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchMock = vi.fn(async () => {
      throw abort;
    });
    vi.stubGlobal("fetch", fetchMock);

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
