import type { NextConfig } from "next";

/**
 * Approved remote image hosts (Catalog Platform v1B).
 *
 * Materialized external titles and federated Explore results reference posters
 * from a small, explicit allow-list of provider-controlled CDNs. These are the
 * ONLY remote hosts permitted — provider adapters already build image URLs from
 * a provider-controlled path against exactly these hosts, so no arbitrary remote
 * image can be rendered. Do not widen this list without a deliberate review.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // TMDB posters/backdrops (movies + TV).
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      // Open Library cover images (books).
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/b/**",
      },
    ],
  },
};

export default nextConfig;
