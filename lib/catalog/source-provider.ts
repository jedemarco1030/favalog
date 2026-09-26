import type { ExternalProvider } from "./types";

const EXTERNAL_PROVIDERS: readonly ExternalProvider[] = [
  "tmdb",
  "openlibrary",
  "rawg",
];

/**
 * Map a `media_items.source` value to the external provider whose attribution
 * the title must carry. Curated rows (`'favalog'`) and any unrecognized value
 * return `null`, so an unknown source never renders a wrong credit.
 */
export function providerFromSource(source: unknown): ExternalProvider | null {
  if (typeof source !== "string") return null;
  return EXTERNAL_PROVIDERS.find((provider) => provider === source) ?? null;
}
