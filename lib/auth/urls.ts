import "server-only";

import { headers } from "next/headers";

import { siteConfig } from "@/lib/site-config";

/**
 * Build absolute URLs from a TRUSTED origin for auth callbacks and emails.
 *
 * OAuth `redirectTo` and password-reset links must be absolute and must point
 * back at this deployment. We derive the origin from the incoming request's
 * forwarded headers (set by Vercel / the platform proxy) and fall back to the
 * configured `siteConfig.url`. We never trust a user-supplied origin, and the
 * *path* portion of any return-to is separately validated by
 * `getSafeRedirectPath` before it is appended.
 *
 * Supabase additionally only honors redirect targets on its own allow-list
 * (Site URL + Additional Redirect URLs), so a misconfigured origin cannot be
 * used to redirect elsewhere even if this fell back incorrectly.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();

  const forwardedHost =
    headerList.get("x-forwarded-host") ?? headerList.get("host");
  const forwardedProto = headerList.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // No request headers available (e.g. during certain build-time calls).
  return siteConfig.url;
}

/**
 * Resolve a path against the trusted request origin, returning an absolute URL
 * string suitable for Supabase `redirectTo` / `emailRedirectTo`.
 */
export async function absoluteUrl(path: string): Promise<string> {
  const origin = await getRequestOrigin();
  return new URL(path, origin).toString();
}
