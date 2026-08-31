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

/** Tokens accepted as an explicit "on"/"off" for a boolean env flag. */
const TRUTHY_TOKENS = new Set(["true", "1", "on", "yes"]);
const FALSEY_TOKENS = new Set(["false", "0", "off", "no"]);

/**
 * Read the server-only kill switch for external catalog discovery.
 *
 * Defaults to OFF: external discovery is a new, opt-in surface, so it stays
 * disabled unless `EXTERNAL_CATALOG_ENABLED` is explicitly set to a truthy
 * token (`true`/`1`/`on`/`yes`, case-insensitive, trimmed). Any other value —
 * including unset, blank, or a falsey token — keeps it disabled. Returns only a
 * boolean, never the raw value.
 *
 * This is the GLOBAL kill switch: when off, NO external provider is available
 * regardless of its own per-provider flag.
 */
export function isExternalCatalogEnabled(): boolean {
  const raw = process.env.EXTERNAL_CATALOG_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return false;
  return TRUTHY_TOKENS.has(raw);
}

/**
 * Explicit, server-only TMDB PROVIDER enablement flag (`TMDB_ENABLED`).
 *
 * Independent of the global kill switch and of TMDB credential presence. It
 * DEFAULTS TO DISABLED and must be turned on with an explicit truthy token
 * (`true`/`1`/`on`/`yes`). Any other value — unset, blank, or falsey — keeps
 * TMDB disabled.
 *
 * WHY it defaults off: the current TMDB API Terms broadly restrict using TMDB
 * APIs/content in connection with an AI/ML-based application. Favalog has NOT
 * obtained permission or licensing for that use, so live TMDB search and
 * materialization must stay OFF in production until the owner confirms
 * appropriate permission through TMDB's official API licensing/support channel.
 * The presence of `TMDB_API_READ_TOKEN` is NOT proof of such permission and
 * never enables TMDB on its own. Returns only a boolean, never the raw value.
 */
export function isTmdbEnabled(): boolean {
  const raw = process.env.TMDB_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return false;
  return TRUTHY_TOKENS.has(raw);
}

/**
 * Explicit, server-only Open Library PROVIDER enablement flag
 * (`OPEN_LIBRARY_ENABLED`).
 *
 * Independent of TMDB. It DEFAULTS TO ENABLED (Open Library carries no AI/ML use
 * restriction comparable to the current TMDB terms), preserving existing
 * behavior, and can be turned OFF with an explicit falsey token
 * (`false`/`0`/`off`/`no`) as an operator control. Returns only a boolean.
 */
export function isOpenLibraryEnabled(): boolean {
  const raw = process.env.OPEN_LIBRARY_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return !FALSEY_TOKENS.has(raw);
}

/**
 * Whether a specific provider is enabled by its own per-provider flag,
 * independent of the global kill switch and of credential configuration. This is
 * the single place the per-provider production controls live so TMDB and Open
 * Library can be enabled independently.
 */
export function isExternalProviderEnabled(provider: ExternalProvider): boolean {
  return provider === "tmdb" ? isTmdbEnabled() : isOpenLibraryEnabled();
}

/**
 * The providers currently available for external discovery. A provider is
 * available only when ALL of these hold:
 *   1. the global `EXTERNAL_CATALOG_ENABLED` kill switch is on;
 *   2. the provider's own enablement flag is on (TMDB defaults OFF, Open Library
 *      defaults ON); AND
 *   3. the provider is actually configured with its credentials.
 * Used to decide which secondary Explore sections to fetch and render.
 */
export function availableExternalProviders(): ExternalProvider[] {
  if (!isExternalCatalogEnabled()) return [];
  const providers: ExternalProvider[] = [];
  if (isTmdbEnabled() && isTmdbConfigured()) providers.push("tmdb");
  if (isOpenLibraryEnabled() && isOpenLibraryConfigured()) {
    providers.push("openlibrary");
  }
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
