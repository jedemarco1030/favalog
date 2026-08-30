import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getOpenLibraryContact,
  isOpenLibraryConfigured,
} from "./openlibrary/config";
import { createServerProviderRegistry } from "./provider-registry";
import { getTmdbToken, isTmdbConfigured } from "./tmdb/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("provider configuration predicates", () => {
  it("reads the TMDB token and reports configured state", () => {
    vi.stubEnv("TMDB_API_READ_TOKEN", "  token-abc  ");
    expect(getTmdbToken()).toBe("token-abc");
    expect(isTmdbConfigured()).toBe(true);
  });

  it("treats a blank TMDB token as not configured", () => {
    vi.stubEnv("TMDB_API_READ_TOKEN", "   ");
    expect(getTmdbToken()).toBeUndefined();
    expect(isTmdbConfigured()).toBe(false);
  });

  it("reads the Open Library contact and reports configured state", () => {
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "dev@example.com");
    expect(getOpenLibraryContact()).toBe("dev@example.com");
    expect(isOpenLibraryConfigured()).toBe(true);
  });

  it("treats a blank Open Library contact as not configured", () => {
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "");
    expect(getOpenLibraryContact()).toBeUndefined();
    expect(isOpenLibraryConfigured()).toBe(false);
  });
});

describe("createServerProviderRegistry", () => {
  it("registers the real TMDB and Open Library providers", () => {
    const registry = createServerProviderRegistry();
    expect(registry.ids().sort()).toEqual(["openlibrary", "tmdb"]);
    expect(registry.has("tmdb")).toBe(true);
    expect(registry.has("openlibrary")).toBe(true);
    expect(registry.get("tmdb").kinds).toEqual(["movie", "tv"]);
    expect(registry.get("openlibrary").kinds).toEqual(["book"]);
  });
});
