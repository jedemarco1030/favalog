import { describe, expect, it } from "vitest";

import {
  EmbeddingError,
  classifyHttpStatus,
  embeddingErrorFromStatus,
  isFatalPipelineError,
  toSafeErrorCategory,
} from "@/lib/search/embedding-errors";

describe("classifyHttpStatus", () => {
  it("maps 401 and 403 to auth", () => {
    expect(classifyHttpStatus(401)).toBe("auth");
    expect(classifyHttpStatus(403)).toBe("auth");
  });

  it("maps 400, 404, and 422 to invalid", () => {
    expect(classifyHttpStatus(400)).toBe("invalid");
    expect(classifyHttpStatus(404)).toBe("invalid");
    expect(classifyHttpStatus(422)).toBe("invalid");
  });

  it("maps 429 to rate_limit", () => {
    expect(classifyHttpStatus(429)).toBe("rate_limit");
  });

  it("maps 5xx to transient", () => {
    expect(classifyHttpStatus(500)).toBe("transient");
    expect(classifyHttpStatus(503)).toBe("transient");
  });

  it("maps anything else to unknown", () => {
    expect(classifyHttpStatus(200)).toBe("unknown");
    expect(classifyHttpStatus(418)).toBe("unknown");
  });
});

describe("EmbeddingError", () => {
  it("defaults retryable to true for rate_limit and transient", () => {
    expect(new EmbeddingError("rate_limit", "x").retryable).toBe(true);
    expect(new EmbeddingError("transient", "x").retryable).toBe(true);
  });

  it("defaults retryable to false for other kinds", () => {
    expect(new EmbeddingError("config", "x").retryable).toBe(false);
    expect(new EmbeddingError("auth", "x").retryable).toBe(false);
    expect(new EmbeddingError("invalid", "x").retryable).toBe(false);
    expect(new EmbeddingError("unknown", "x").retryable).toBe(false);
  });

  it("respects an explicit retryable override", () => {
    expect(new EmbeddingError("auth", "x", { retryable: true }).retryable).toBe(
      true,
    );
    expect(
      new EmbeddingError("transient", "x", { retryable: false }).retryable,
    ).toBe(false);
  });

  it("stores the provided status", () => {
    const error = new EmbeddingError("invalid", "x", { status: 422 });
    expect(error.status).toBe(422);
    expect(error.name).toBe("EmbeddingError");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("embeddingErrorFromStatus", () => {
  it("builds an EmbeddingError with the classified kind and stored status", () => {
    const error = embeddingErrorFromStatus(429);
    expect(error.kind).toBe("rate_limit");
    expect(error.status).toBe(429);
    expect(error.retryable).toBe(true);
  });

  it("produces a safe, non-sensitive message", () => {
    const error = embeddingErrorFromStatus(500);
    expect(error.message).toBe("embedding request failed (transient)");
  });
});

describe("isFatalPipelineError", () => {
  it("is true only for config and auth", () => {
    expect(isFatalPipelineError(new EmbeddingError("config", "x"))).toBe(true);
    expect(isFatalPipelineError(new EmbeddingError("auth", "x"))).toBe(true);
  });

  it("is false for retryable / non-fatal kinds", () => {
    expect(isFatalPipelineError(new EmbeddingError("rate_limit", "x"))).toBe(
      false,
    );
    expect(isFatalPipelineError(new EmbeddingError("transient", "x"))).toBe(
      false,
    );
    expect(isFatalPipelineError(new EmbeddingError("invalid", "x"))).toBe(
      false,
    );
    expect(isFatalPipelineError(new EmbeddingError("unknown", "x"))).toBe(
      false,
    );
  });
});

describe("toSafeErrorCategory", () => {
  it("unwraps an EmbeddingError to its kind", () => {
    expect(toSafeErrorCategory(new EmbeddingError("rate_limit", "x"))).toBe(
      "rate_limit",
    );
  });

  it("classifies AbortError and TimeoutError as transient", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(toSafeErrorCategory(abort)).toBe("transient");

    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    expect(toSafeErrorCategory(timeout)).toBe("transient");
  });

  it("classifies a fetch-mentioning TypeError as transient", () => {
    const error = new TypeError("fetch failed");
    expect(toSafeErrorCategory(error)).toBe("transient");
  });

  it("treats a plain Error as unknown", () => {
    expect(toSafeErrorCategory(new Error("boom"))).toBe("unknown");
  });

  it("treats a non-fetch TypeError as unknown", () => {
    expect(toSafeErrorCategory(new TypeError("bad argument"))).toBe("unknown");
  });

  it("treats non-Error values as unknown", () => {
    expect(toSafeErrorCategory("just a string")).toBe("unknown");
    expect(toSafeErrorCategory(null)).toBe("unknown");
    expect(toSafeErrorCategory(undefined)).toBe("unknown");
    expect(toSafeErrorCategory({ message: "nope" })).toBe("unknown");
  });
});
