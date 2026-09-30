import { readFile } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext } from "@playwright/test";
import sharp from "sharp";

/**
 * Representative provider artwork for configured-fixture measurements.
 *
 * The offline provider fixtures return provider image paths that 404 upstream,
 * so without this every provider card renders its no-artwork fallback and the
 * page weighs far less than a real one. This routes the BROWSER's
 * `/_next/image` requests for the allow-listed provider CDNs to two committed
 * fixture JPEGs (500x750 poster, 1280x720 backdrop — TMDB w500/w1280 sizes),
 * re-encoded with sharp at the requested width and quality, which is what the
 * Next.js optimizer itself does.
 *
 * What this does NOT represent, and must be stated next to any number it
 * produces: CDN fetch latency, optimizer CPU cost, and network throttling of
 * the image bytes (route-fulfilled responses bypass CDP throttling). Byte
 * counts are representative; image transfer TIME is not.
 */

const ARTWORK_DIR = path.join(process.cwd(), "e2e/fixtures/artwork");
const PROVIDER_CDN =
  /^https:\/\/(image\.tmdb\.org|covers\.openlibrary\.org|media\.rawg\.io)\//;
const LANDSCAPE_TMDB_SIZE = /\/t\/p\/(w780|w1280|original)\//;

export interface ArtworkStats {
  requests: number;
  bytes: number;
  byAsset: { poster: number; backdrop: number };
}

export function isLandscapeArtwork(providerUrl: string): boolean {
  return (
    LANDSCAPE_TMDB_SIZE.test(providerUrl) ||
    providerUrl.startsWith("https://media.rawg.io/")
  );
}

export async function routeProviderArtwork(
  context: BrowserContext,
): Promise<ArtworkStats> {
  const [poster, backdrop] = await Promise.all([
    readFile(path.join(ARTWORK_DIR, "poster.jpg")),
    readFile(path.join(ARTWORK_DIR, "backdrop.jpg")),
  ]);
  const cache = new Map<string, Buffer>();
  const stats: ArtworkStats = {
    requests: 0,
    bytes: 0,
    byAsset: { poster: 0, backdrop: 0 },
  };

  await context.route(
    (url) =>
      url.pathname === "/_next/image" &&
      PROVIDER_CDN.test(url.searchParams.get("url") ?? ""),
    async (route) => {
      const url = new URL(route.request().url());
      const source = url.searchParams.get("url") ?? "";
      const width = Math.min(
        Math.max(Number(url.searchParams.get("w")) || 640, 16),
        3840,
      );
      const quality = Math.min(
        Math.max(Number(url.searchParams.get("q")) || 75, 1),
        100,
      );
      const asset = isLandscapeArtwork(source) ? "backdrop" : "poster";
      const key = `${asset}:${width}:${quality}`;
      let body = cache.get(key);
      if (!body) {
        body = await sharp(asset === "backdrop" ? backdrop : poster)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
        cache.set(key, body);
      }
      stats.requests += 1;
      stats.bytes += body.length;
      stats.byAsset[asset] += 1;
      await route.fulfill({
        status: 200,
        contentType: "image/webp",
        headers: { "cache-control": "no-store" },
        body,
      });
    },
  );

  return stats;
}
