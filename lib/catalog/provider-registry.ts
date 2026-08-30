/**
 * Provider registry — the dependency-injection seam that maps a provider id to a
 * {@link CatalogProvider}.
 *
 * {@link createProviderRegistry} is a pure factory over an explicit provider
 * list, so tests and the CLI can supply fake providers with no network.
 * {@link createServerProviderRegistry} wires the real server-only adapters
 * (TMDB, Open Library) and is the production default.
 */

import { providerError } from "./errors.ts";
import { createOpenLibraryProvider } from "./openlibrary/client.ts";
import { createTmdbProvider } from "./tmdb/client.ts";
import type { CatalogProvider, ExternalProvider } from "./types";

/** A read-only lookup from provider id to its {@link CatalogProvider}. */
export interface ProviderRegistry {
  /** Return the provider for `id`, or throw a safe `not_configured` error. */
  get(id: ExternalProvider): CatalogProvider;
  /** Whether a provider is registered for `id`. */
  has(id: ExternalProvider): boolean;
  /** The registered provider ids. */
  ids(): ExternalProvider[];
}

/** Build a registry from an explicit provider list (pure; DI-friendly). */
export function createProviderRegistry(
  providers: readonly CatalogProvider[],
): ProviderRegistry {
  const byId = new Map<ExternalProvider, CatalogProvider>();
  for (const provider of providers) byId.set(provider.id, provider);

  return {
    get(id) {
      const provider = byId.get(id);
      if (!provider) {
        throw providerError({
          provider: id,
          operation: "registry.get",
          category: "not_configured",
        });
      }
      return provider;
    },
    has(id) {
      return byId.has(id);
    },
    ids() {
      return Array.from(byId.keys());
    },
  };
}

/**
 * The production registry wired to the real server-only adapters. Constructing
 * the adapters does NOT read a secret or perform I/O; credentials are read only
 * when an operation actually runs, so this is safe to build even when no
 * provider is configured (individual calls then fail closed).
 */
export function createServerProviderRegistry(): ProviderRegistry {
  return createProviderRegistry([
    createTmdbProvider(),
    createOpenLibraryProvider(),
  ]);
}
