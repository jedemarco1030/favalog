import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { assertLoopbackSupabaseUrl } from "./lib/local-supabase-target.mjs";

/**
 * A database reset can finish before the gateway reconnects to Auth. Probe the
 * read-only admin endpoint, not user creation: repeating a write could hide an
 * application failure or leave partially provisioned fixture accounts.
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   pollIntervalMs?: number,
 *   requestTimeoutMs?: number,
 *   now?: () => number,
 *   sleep?: (ms: number) => Promise<unknown>
 * }} [options]
 */
export async function waitForLocalSupabaseAuth({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 60_000,
  pollIntervalMs = 1_000,
  requestTimeoutMs = 5_000,
  now = () => performance.now(),
  sleep = delay,
} = {}) {
  const url = assertLoopbackSupabaseUrl(
    env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    "SUPABASE_URL",
  );
  const key = (
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  if (!key) {
    throw new Error("[e2e readiness] Missing local Supabase admin key.");
  }

  const endpoint = new URL("auth/v1/admin/users", `${url.replace(/\/$/, "")}/`);
  endpoint.search = "page=1&per_page=1";
  const started = now();
  const deadline = started + timeoutMs;
  let attempts = 0;
  let lastStatus = "no response";

  while (now() < deadline) {
    attempts += 1;
    let response;
    let body;
    try {
      response = await fetchImpl(endpoint, {
        method: "GET",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // Never forward a privileged local key to a redirected remote host.
        redirect: "error",
        signal: AbortSignal.timeout(
          Math.max(1, Math.ceil(Math.min(requestTimeoutMs, deadline - now()))),
        ),
      });
      lastStatus = `HTTP ${response.status}`;
      if (response.ok) {
        body = await response.json();
        if (Array.isArray(body?.users)) {
          return { attempts, elapsedMs: Math.round(now() - started) };
        }
        lastStatus = "invalid Auth admin response";
      } else {
        await response.body?.cancel();
      }
    } catch {
      // Do not print response bodies, fetched users, credentials or raw errors.
      lastStatus = "network, response parsing or request timeout failure";
    }

    if (response && response.status >= 400 && response.status < 500) {
      throw new Error(
        `[e2e readiness] Local Supabase Auth rejected the admin probe (HTTP ${response.status}); tests not executed.`,
      );
    }
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(pollIntervalMs, remaining));
  }

  throw new Error(
    `[e2e readiness] Local Supabase Auth did not become ready within ${timeoutMs}ms (${attempts} probes; ${lastStatus}); tests not executed.`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const { attempts, elapsedMs } = await waitForLocalSupabaseAuth();
    console.log(
      `[e2e readiness] Local Supabase Auth ready after ${attempts} read-only probe(s), ${elapsedMs}ms.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Auth readiness failed.",
    );
    process.exitCode = 1;
  }
}
