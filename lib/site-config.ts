/**
 * Centralized brand and site metadata for Favalog.
 *
 * Import `siteConfig` instead of re-typing the product name, tagline, or
 * canonical URL in individual files. When the product gets a real domain
 * or the copy changes, this is the one place to update.
 */

const FALLBACK_SITE_URL = "https://favalog.vercel.app";

/**
 * Resolve the canonical site URL without hardcoding a production domain we
 * do not yet own. Priority:
 *   1. `NEXT_PUBLIC_SITE_URL` — explicit override for any environment.
 *   2. `VERCEL_URL`           — automatically injected on Vercel previews.
 *   3. `http://localhost:3000` in development.
 *   4. The current deployment URL, https://favalog.vercel.app.
 *
 * TODO(canonical-domain): once a production domain (e.g. favalog.com) is
 * chosen and owned, either set `NEXT_PUBLIC_SITE_URL` at deploy time or
 * update `FALLBACK_SITE_URL` above.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return FALLBACK_SITE_URL;
}

export const siteConfig = {
  name: "Favalog",
  /** Primary MVP tagline. Keep usage sparing — hero + footer, not every page. */
  tagline: "Everything you watch and read. One place to remember it.",
  /** Longer-term tagline for once games, music, and more are in scope. */
  futureTagline: "Your life, through what you love.",
  shortDescription:
    "Favalog is a social home for everything you watch and read. Track movies, TV, and books, rate them, review them, and remember them.",
  url: resolveSiteUrl(),
} as const;
