import { afterEach, describe, expect, it, vi } from "vitest";

import {
  availableExternalProviders,
  isExternalCatalogEnabled,
  isExternalProviderAvailable,
  isExternalProviderEnabled,
  isOpenLibraryEnabled,
  isTmdbEnabled,
  shouldOfferExternalCatalog,
} from "./feature-flag";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Enable the global switch, explicitly enable BOTH providers, and configure both
 * credentials unless overridden. TMDB must be explicitly enabled because it
 * defaults OFF (its API Terms restrict AI/ML use).
 */
function configureAll() {
  vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
  vi.stubEnv("TMDB_ENABLED", "true");
  vi.stubEnv("OPEN_LIBRARY_ENABLED", "true");
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

  it("offers only the configured+enabled providers when the flag is on", () => {
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
    vi.stubEnv("TMDB_ENABLED", "true");
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
    vi.stubEnv("TMDB_ENABLED", "true");
    vi.stubEnv("TMDB_API_READ_TOKEN", "");
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "");
    expect(availableExternalProviders()).toEqual([]);
    expect(shouldOfferExternalCatalog()).toBe(false);
  });
});

describe("isTmdbEnabled (defaults OFF; TMDB AI/ML compliance gate)", () => {
  it("defaults to OFF when unset", () => {
    vi.stubEnv("TMDB_ENABLED", "");
    expect(isTmdbEnabled()).toBe(false);
  });

  it.each(["true", "1", "on", "yes", "  On  "])(
    "is enabled only for the explicit truthy token %s",
    (token) => {
      vi.stubEnv("TMDB_ENABLED", token);
      expect(isTmdbEnabled()).toBe(true);
    },
  );

  it.each(["false", "0", "off", "no", "maybe", "enabled?"])(
    "stays OFF for the non-truthy token %s",
    (token) => {
      vi.stubEnv("TMDB_ENABLED", token);
      expect(isTmdbEnabled()).toBe(false);
    },
  );

  it("is NOT enabled by the mere presence of a TMDB API token", () => {
    vi.stubEnv("TMDB_ENABLED", "");
    vi.stubEnv("TMDB_API_READ_TOKEN", "token-abc");
    expect(isTmdbEnabled()).toBe(false);
  });
});

describe("isOpenLibraryEnabled (defaults ON; independent of TMDB)", () => {
  it("defaults to ON when unset", () => {
    vi.stubEnv("OPEN_LIBRARY_ENABLED", "");
    expect(isOpenLibraryEnabled()).toBe(true);
  });

  it.each(["false", "0", "off", "no", "  OFF  "])(
    "can be turned OFF with the explicit falsey token %s",
    (token) => {
      vi.stubEnv("OPEN_LIBRARY_ENABLED", token);
      expect(isOpenLibraryEnabled()).toBe(false);
    },
  );

  it("stays ON for any non-falsey token", () => {
    vi.stubEnv("OPEN_LIBRARY_ENABLED", "true");
    expect(isOpenLibraryEnabled()).toBe(true);
  });
});

describe("per-provider gate keeps TMDB and Open Library independent", () => {
  it("routes isExternalProviderEnabled to the right per-provider flag", () => {
    vi.stubEnv("TMDB_ENABLED", "true");
    vi.stubEnv("OPEN_LIBRARY_ENABLED", "off");
    expect(isExternalProviderEnabled("tmdb")).toBe(true);
    expect(isExternalProviderEnabled("openlibrary")).toBe(false);
  });

  it("keeps Open Library available while TMDB stays disabled by default", () => {
    // Global switch on, both configured, but TMDB left at its OFF default.
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
    vi.stubEnv("TMDB_API_READ_TOKEN", "token-abc");
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "dev@example.com");
    expect(availableExternalProviders()).toEqual(["openlibrary"]);
    expect(isExternalProviderAvailable("tmdb")).toBe(false);
    expect(isExternalProviderAvailable("openlibrary")).toBe(true);
    expect(shouldOfferExternalCatalog()).toBe(true);
  });

  it("blocks TMDB even when configured if TMDB_ENABLED is falsey", () => {
    vi.stubEnv("EXTERNAL_CATALOG_ENABLED", "true");
    vi.stubEnv("TMDB_ENABLED", "false");
    vi.stubEnv("OPEN_LIBRARY_ENABLED", "false");
    vi.stubEnv("TMDB_API_READ_TOKEN", "token-abc");
    vi.stubEnv("OPEN_LIBRARY_CONTACT_EMAIL", "dev@example.com");
    expect(availableExternalProviders()).toEqual([]);
    expect(isExternalProviderAvailable("tmdb")).toBe(false);
  });
});
