/**
 * RAWG adapter configuration (server-only).
 *
 * RAWG authenticates with an API key passed as the `key` query parameter. The
 * key comes from the server-only `RAWG_API_KEY`; when it is missing a LIVE
 * request fails closed with a `not_configured` provider error. RAWG's terms
 * require a visible attribution link to RAWG wherever its data appears, and
 * commercial use beyond the free tier needs a paid plan — so the provider is
 * also gated OFF by default behind `RAWG_ENABLED` (see `feature-flag.ts`).
 * Nothing here throws at import time.
 */

/** RAWG API base. */
export const RAWG_BASE = "https://api.rawg.io/api" as const;
/** The only approved RAWG image host. */
export const RAWG_IMAGE_HOST = "media.rawg.io" as const;
/** Public attribution target required by RAWG's terms. */
export const RAWG_ATTRIBUTION_URL = "https://rawg.io" as const;

/**
 * Read the server-only RAWG API key. Returns `undefined` (never throws) when
 * unset/blank so live callers fail closed with `not_configured`.
 */
export function getRawgApiKey(): string | undefined {
  const key = process.env.RAWG_API_KEY?.trim();
  return key ? key : undefined;
}

/** Whether RAWG credentials are configured. */
export function isRawgConfigured(): boolean {
  return getRawgApiKey() !== undefined;
}

/**
 * Accept a RAWG image URL only when it is https on the approved host under
 * `/media/`. Anything else (another host, http, malformed) yields `undefined`
 * so no arbitrary URL can reach persistence or `next/image`.
 */
export function rawgImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") return undefined;
  if (parsed.hostname !== RAWG_IMAGE_HOST) return undefined;
  if (!parsed.pathname.startsWith("/media/")) return undefined;
  if (parsed.username || parsed.password) return undefined;
  return `https://${RAWG_IMAGE_HOST}${parsed.pathname}`;
}

/** RAWG game ids are positive integers; accept only their canonical form. */
export function isRawgGameId(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value);
}

/** Stringify a RAWG numeric id, or `undefined` when it is not a valid id. */
export function rawgIdToExternalId(id: unknown): string | undefined {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    return undefined;
  }
  const text = String(id);
  return isRawgGameId(text) ? text : undefined;
}
