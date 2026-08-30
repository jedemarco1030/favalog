import { afterEach, describe, expect, it, vi } from "vitest";

import {
  availableExternalProviders,
  isExternalCatalogEnabled,
  isExternalProviderAvailable,
  shouldOfferExternalCatalog,
} from "./feature-flag";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Enable the flag and configure both providers unless overridden. */
function configureAll() {
  vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
  vi.stubEnv("TMDB_API_READ_TOKEN", "token-abc");
  vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "dev@example.com");
}

describe("isExternalCatalogEnabled", () => {
  it("defaults to OFF when the switch is unset", () => {
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "");
    expect(isExternalCatalogEnabled()).toBe(false);
  });

  it.each(["true", "1", "on", "yes", "  YES  ", "On"])(
    "enables for the truthy token %s",
    (token) => {
      vi.stubEnv("EXTERNAL_CATALOG_ENABLED", token);
      expect(isExternalCatalogEnabled()).toBe(true);
    },
  );

  it.each(["false", "0", "off", "no", "nope", "disabled"])(
    "stays OFF for the non-truthy token %s",
    (token) => {
      vi.stubEnv("EXTERNAL_CATALOG_ENABLED", token);
      expect(isExternalCatalogEnabled()).toBe(false);
    },
  );
});

describe("availableExternalProviders / shouldOfferExternalCatalog", () => {
  it("offers nothing when the flag is off, even if providers are configured", () => {
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "false");
    vi.stubEnv("TMDB_API_READ_TOKEN", "token-abc");
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "dev@example.com");
    expect(availableExternalProviders()).toEqual([]);
    expect(shouldOfferExternalCatalog()).toBe(false);
  });

  it("offers only the configured providers when the flag is on", () => {
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
    vi.stubEnv("TMDB_API_READ_TOKEN", "token-abc");
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "");
    expect(availableExternalProviders()).toEqual(["tmdb"]);
    expect(isExternalProviderAvailable("tmdb")).toBe(true);
    expect(isExternalProviderAvailable("openlibrary")).toBe(false);
    expect(shouldOfferExternalCatalog()).toBe(true);
  });

  it("offers both providers when the flag is on and both are configured", () => {
    configureAll();
    expect(availableExternalProviders().sort()).toEqual([
      "openlibrary",
      "tmdb",
    ]);
    expect(shouldOfferExternalCatalog()).toBe(true);
  });

  it("offers nothing when the flag is on but no provider is configured", () => {
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
    vi.stubEnv("TMDB_API_READ_TOKEN", "");
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "");
    expect(availableExternalProviders()).toEqual([]);
    expect(shouldOfferExternalCatalog()).toBe(false);
  });
});
