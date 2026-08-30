/**
 * Server-only feature gate for federated external Explore discovery (Catalog
 * Platform v1B).
 *
 * External discovery (searching TMDB / Open Library and offering an import) is
 * strictly OPT-IN. It is enabled only when BOTH:
 *   1. the operator turns on the server-only `EXTERNAL_CATALOG_ENABLED` kill
 *      switch (a plain, non-`NEXT_PUBLIC_` variable, so no configuration leaks
 *      to the browser), AND
 *   2. the relevant provider is actually configured with its credentials
 *      (`TMDB_API_READ_TOKEN` for movies/TV, `OPEN_LIBRARY_CONTACT_EMAIL` for
 *      books).
 *
 * When the flag is unset/disabled OR a provider is unconfigured, the existing
 * local hybrid Explore experience is preserved unchanged — no external call is
 * made, and there is no import-time or build-time crash (nothing here reads a
 * secret VALUE or performs I/O; it only reads booleans/presence).
 *
 * Server-only: never import from a client component.
 */

import { isOpenLibraryConfigured } from "./openlibrary/config";
import { isTmdbConfigured } from "./tmdb/config";
import type { ExternalProvider } from "./types";

/**
 * Read the server-only kill switch for external catalog discovery.
 *
 * Defaults to OFF: external discovery is a new, opt-in surface, so it stays
 * disabled unless `EXTERNAL_CATALOG_ENABLED` is explicitly set to a truthy
 * token (`true`/`1`/`on`/`yes`, case-insensitive, trimmed). Any other value —
 * including unset, blank, or a falsey token — keeps it disabled. Returns only a
 * boolean, never the raw value.
 */
export function isExternalCatalogEnabled(): boolean {
  const raw = process.env.EXTERNAL_CATALOG_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return false;
  return raw === "true" || raw === "1" || raw === "on" || raw === "yes";
}

/**
 * The providers currently available for external discovery: the flag must be on
 * AND that provider must be configured. Used to decide which secondary Explore
 * sections to fetch and render.
 */
export function availableExternalProviders(): ExternalProvider[] {
  if (!isExternalCatalogEnabled()) return [];
  const providers: ExternalProvider[] = [];
  if (isTmdbConfigured()) providers.push("tmdb");
  if (isOpenLibraryConfigured()) providers.push("openlibrary");
  return providers;
}

/**
 * Whether a specific provider should be offered for external discovery right
 * now (flag on AND that provider configured).
 */
export function isExternalProviderAvailable(
  provider: ExternalProvider,
): boolean {
  return availableExternalProviders().includes(provider);
}

/**
 * The single predicate the Explore layer uses to decide whether to attempt ANY
 * external discovery: the flag must be on AND at least one provider configured.
 * When false, Explore renders local results only, exactly as before v1B.
 */
export function shouldOfferExternalCatalog(): boolean {
  return availableExternalProviders().length > 0;
}
