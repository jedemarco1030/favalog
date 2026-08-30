import { describe, expect, it } from "vitest";

import {
  CatalogProviderError,
  categoryForStatus,
  isRetryableCategory,
  providerError,
  safeMessageFor,
  type ProviderErrorCategory,
} from "./errors";

describe("categoryForStatus", () => {
  it("maps 401/403 to unauthorized", () => {
    expect(categoryForStatus(401)).toBe("unauthorized");
    expect(categoryForStatus(403)).toBe("unauthorized");
  });

  it("maps 404 to not_found", () => {
    expect(categoryForStatus(404)).toBe("not_found");
  });

  it("maps 400/422 to validation", () => {
    expect(categoryForStatus(400)).toBe("validation");
    expect(categoryForStatus(422)).toBe("validation");
  });

  it("maps 429 to rate_limited", () => {
    expect(categoryForStatus(429)).toBe("rate_limited");
  });

  it("maps 5xx to unavailable", () => {
    expect(categoryForStatus(500)).toBe("unavailable");
    expect(categoryForStatus(503)).toBe("unavailable");
    expect(categoryForStatus(599)).toBe("unavailable");
  });

  it("maps anything else to unknown", () => {
    expect(categoryForStatus(200)).toBe("unknown");
    expect(categoryForStatus(302)).toBe("unknown");
    expect(categoryForStatus(418)).toBe("unknown");
    expect(categoryForStatus(600)).toBe("unknown");
  });
});

describe("isRetryableCategory", () => {
  it("is true only for rate_limited, unavailable, and timeout", () => {
    expect(isRetryableCategory("rate_limited")).toBe(true);
    expect(isRetryableCategory("unavailable")).toBe(true);
    expect(isRetryableCategory("timeout")).toBe(true);
  });

  it("is false for terminal categories", () => {
    const terminal: ProviderErrorCategory[] = [
      "unauthorized",
      "validation",
      "not_found",
      "not_configured",
      "unknown",
    ];
    for (const category of terminal) {
      expect(isRetryableCategory(category)).toBe(false);
    }
  });
});

describe("providerError / CatalogProviderError", () => {
  it("sets provider, operation, category, status, and retryAfterMs", () => {
    const error = providerError({
      provider: "tmdb",
      operation: "search",
      category: "rate_limited",
      status: 429,
      retryAfterMs: 1500,
    });
    expect(error).toBeInstanceOf(CatalogProviderError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CatalogProviderError");
    expect(error.provider).toBe("tmdb");
    expect(error.operation).toBe("search");
    expect(error.category).toBe("rate_limited");
    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(1500);
  });

  it("exposes a retryable getter derived from the category", () => {
    expect(
      providerError({
        provider: "tmdb",
        operation: "search",
        category: "unavailable",
      }).retryable,
    ).toBe(true);
    expect(
      providerError({
        provider: "openlibrary",
        operation: "getByExternalId",
        category: "not_found",
      }).retryable,
    ).toBe(false);
  });

  it("uses a safe default message containing provider + operation but no dynamic upstream content", () => {
    const error = providerError({
      provider: "openlibrary",
      operation: "getByExternalId",
      category: "not_found",
    });
    expect(error.message).toContain("openlibrary");
    expect(error.message).toContain("getByExternalId");
    expect(error.message).toBe(
      safeMessageFor("not_found", "openlibrary", "getByExternalId"),
    );
    // No URL, query text, token, or raw payload should ever appear.
    expect(error.message).not.toMatch(/https?:\/\//);
    expect(error.message).not.toMatch(/token|Bearer|api_key/i);
  });

  it("honours an explicit override message", () => {
    const error = providerError(
      { provider: "tmdb", operation: "search", category: "validation" },
      "[tmdb] search failed: query too short",
    );
    expect(error.message).toBe("[tmdb] search failed: query too short");
  });
});

describe("safeMessageFor", () => {
  const categories: ProviderErrorCategory[] = [
    "unauthorized",
    "validation",
    "not_found",
    "rate_limited",
    "unavailable",
    "timeout",
    "not_configured",
    "unknown",
  ];

  it("produces a distinct, provider+operation-labelled message for every category", () => {
    const messages = new Set<string>();
    for (const category of categories) {
      const message = safeMessageFor(category, "tmdb", "search");
      expect(message).toContain("[tmdb]");
      expect(message).toContain("search");
      expect(message.length).toBeGreaterThan(0);
      messages.add(message);
    }
    // Each category yields a unique reason string.
    expect(messages.size).toBe(categories.length);
  });
});
