/**
 * Artwork classification.
 *
 * Favalog distinguishes three things that all used to render as "an image":
 *
 * - `provider`: a URL on one of the approved provider CDNs (the same allow-list
 *   as `images.remotePatterns` in `next.config.ts`). This is real artwork.
 * - `placeholder`: a bundled local asset under `/media/`. These are the
 *   generated graphics shipped with the demo seed catalog. They are NOT artwork
 *   for the title and are never shown as though they were.
 * - `missing`: no URL at all, or a URL on any other host.
 *
 * Only `provider` artwork is displayed. Everything else falls back to the
 * intentional typographic treatment, so a title without artwork stays fully
 * usable without borrowing unrelated or generated imagery.
 */

export type ArtworkStatus = "provider" | "placeholder" | "missing";

export const APPROVED_ARTWORK_HOSTS: readonly string[] = [
  "image.tmdb.org",
  "covers.openlibrary.org",
  "media.rawg.io",
];

/** Where the demo seed catalog's bundled placeholder graphics live. */
export const PLACEHOLDER_ARTWORK_PREFIX = "/media/";

export function classifyArtwork(url: string | null | undefined): ArtworkStatus {
  if (!url) return "missing";
  if (url.startsWith(PLACEHOLDER_ARTWORK_PREFIX)) return "placeholder";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      APPROVED_ARTWORK_HOSTS.includes(parsed.hostname)
      ? "provider"
      : "missing";
  } catch {
    return "missing";
  }
}

/** The URL when it is real provider artwork, otherwise `undefined`. */
export function displayableArtwork(
  url: string | null | undefined,
): string | undefined {
  return classifyArtwork(url) === "provider" ? (url ?? undefined) : undefined;
}

export function hasProviderPoster(item: {
  posterUrl?: string | null;
}): boolean {
  return classifyArtwork(item.posterUrl) === "provider";
}

export function hasProviderBackdrop(item: {
  backdropUrl?: string | null;
}): boolean {
  return classifyArtwork(item.backdropUrl) === "provider";
}
