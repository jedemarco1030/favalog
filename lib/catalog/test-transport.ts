/**
 * Test-only external-provider transport override (Catalog Platform v1B).
 *
 * WHY: the deterministic runtime (Playwright) coverage of federated Explore and
 * on-demand materialization must exercise the REAL production provider adapters,
 * Server Action, canonical RPC, redirect, and title-page code paths — but
 * without contacting TMDB / Open Library and without provider secrets. This
 * module lets an EXPLICIT test environment point the real adapters at a LOCAL
 * fixture HTTP server by overriding only their base URL. It is NOT a provider
 * registry replacement and adds NO production backdoor:
 *
 *   1. It is honored ONLY when the explicit server-only opt-in
 *      `CATALOG_TEST_TRANSPORT` is truthy. No real deployment ever sets it.
 *   2. It accepts ONLY a loopback endpoint (`127.0.0.1` / `localhost` / `::1`)
 *      over plain `http` — never a public host, never `https`, never an IP that
 *      could reach off-box.
 *   3. It is REJECTED under a production runtime (a Vercel deployment:
 *      `VERCEL_ENV === "production"` or `VERCEL === "1"`), even if the opt-in and
 *      a loopback URL were somehow present — defense in depth.
 *   4. It reads ONLY `process.env` (server-only). It can NEVER be activated by a
 *      query parameter, request header, cookie, or any other browser input, and
 *      it never reaches a client bundle.
 *   5. Any missing/invalid/non-loopback value FAILS CLOSED (returns `undefined`),
 *      so the real provider host is used and the override silently does nothing.
 *
 * Server-only: never import from a client component.
 */

/** Explicit opt-in that must be truthy for ANY override to be honored. */
export const TEST_TRANSPORT_ENABLE_ENV = "CATALOG_TEST_TRANSPORT" as const;
/** Per-provider loopback base-URL overrides (only read when opt-in is on). */
export const TMDB_TEST_BASE_URL_ENV = "CATALOG_TEST_TMDB_BASE_URL" as const;
export const OPENLIBRARY_TEST_BASE_URL_ENV =
  "CATALOG_TEST_OPENLIBRARY_BASE_URL" as const;

type EnvLike = Record<string, string | undefined>;

const TRUTHY = new Set(["1", "true", "on", "yes"]);

/** Loopback hostnames that are safe test-fixture targets. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Whether the current runtime is a real production deployment. A genuine Vercel
 * production runtime sets `VERCEL_ENV=production`; any Vercel runtime sets
 * `VERCEL=1`. Either marker rejects the override regardless of the opt-in.
 */
export function isProductionRuntime(env: EnvLike = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.VERCEL === "1";
}

/**
 * Whether the test transport override is permitted at all: the explicit opt-in
 * is truthy AND this is not a production runtime. Returns only a boolean.
 */
export function isTestTransportEnabled(env: EnvLike = process.env): boolean {
  if (isProductionRuntime(env)) return false;
  const raw = env[TEST_TRANSPORT_ENABLE_ENV]?.trim().toLowerCase();
  return raw !== undefined && TRUTHY.has(raw);
}

/** Whether a URL is a plain-http loopback endpoint (the only accepted target). */
export function isLoopbackHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  return LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
}

/**
 * Resolve the loopback base URL override for a provider, or `undefined` when the
 * override is not permitted or the configured value is missing/invalid/non-
 * loopback (fail closed). The returned value has any trailing slash removed so
 * it can be concatenated with adapter paths exactly like the real base constant.
 */
export function resolveTestProviderBaseUrl(
  provider: "tmdb" | "openlibrary",
  env: EnvLike = process.env,
): string | undefined {
  if (!isTestTransportEnabled(env)) return undefined;
  const key =
    provider === "tmdb"
      ? TMDB_TEST_BASE_URL_ENV
      : OPENLIBRARY_TEST_BASE_URL_ENV;
  const raw = env[key]?.trim();
  if (!raw) return undefined;
  if (!isLoopbackHttpUrl(raw)) return undefined;
  return raw.replace(/\/+$/, "");
}
