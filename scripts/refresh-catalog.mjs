// Favalog Catalog Platform — periodic provider-metadata REFRESH worker
// (entrypoint / thin wrapper).
//
// Refreshes already-imported provider-owned catalog rows whose freshness window
// has elapsed, in bounded, resumable, oldest-checked-first batches, by driving
// the service-role-only refresh RPCs. All drift- and SAFETY-critical logic
// (argument parsing, provider-activation gate, LOCAL-vs-REMOTE classification,
// the write-authorization guard, outcome classification, and orchestration)
// lives in the tested `scripts/refresh-catalog-core.ts`, imported here and wired
// to the real Supabase client + provider registry.
//
// This runs ONLY when invoked explicitly (never during migrations, builds,
// tests, page rendering, or a db reset).
//
// Usage:
//   node scripts/refresh-catalog.mjs --dry-run              # read-only preview (provider reads, no writes)
//   node scripts/refresh-catalog.mjs                        # refresh due tmdb rows (local target)
//   node scripts/refresh-catalog.mjs --provider openlibrary # refresh due Open Library rows
//   node scripts/refresh-catalog.mjs --limit 25 --concurrency 4 --freshness-days 7
//
// REMOTE SAFETY (see ADR 0003/0004): a live run against a hosted Supabase
// project requires BOTH --allow-remote AND --confirm-project-ref=<exact-ref>;
// --dry-run stays write-free everywhere. Provider activation is fail-closed: a
// disabled provider makes NO request (clean no-op); an enabled-but-unconfigured
// provider aborts before any request.
//
// OVERLAP PREVENTION: authoritative overlap prevention is provided by the
// scheduler's concurrency group (the GitHub Actions workflow) and by the
// per-identity `pg_advisory_xact_lock` inside each refresh RPC, which guarantees
// no state corruption even if two runs transiently overlap. The run-lock seam
// below is a best-effort no-op over PostgREST (which cannot hold a session
// advisory lock); a future dedicated lock RPC can replace it without touching
// the core.
//
// Env: TMDB_API_READ_TOKEN / OPEN_LIBRARY_CONTACT_EMAIL (the live provider),
// EXTERNAL_CATALOG_ENABLED + the per-provider flag (activation), SUPABASE_URL +
// SUPABASE_SECRET_KEY (service-role, for reads + refresh RPCs).

import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import {
  createProviderRegistry,
  createServerProviderRegistry,
} from "../lib/catalog/provider-registry.ts";
import { createFakeProvider } from "../lib/catalog/fake-provider.ts";
import { runRefreshCatalog } from "./refresh-catalog-core.ts";

// Best-effort: load .env.local so local runs pick up provider/Supabase config.
try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  // Ignore — env may be provided by the shell/CI instead.
}

/** Build the data-access store over a service-role Supabase client. */
function createStore(url, key) {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /** Filter builder shared by countDue + selectDue: due, non-removed rows. */
  const dueFilter = (builder, source, cutoffIso) =>
    builder
      .eq("source", source)
      .is("provider_removed_at", null)
      .or(`provider_checked_at.is.null,provider_checked_at.lte.${cutoffIso}`);

  return {
    async acquireRunLock() {
      // No-op over PostgREST (see the OVERLAP PREVENTION note above).
      return true;
    },
    async releaseRunLock() {
      // Nothing to release for the no-op lock.
    },
    async countDue({ source, cutoffIso }) {
      const { count, error } = await dueFilter(
        supabase
          .from("media_items")
          .select("id", { count: "exact", head: true }),
        source,
        cutoffIso,
      );
      if (error) throw new Error(`countDue failed: ${error.message}`);
      return count ?? 0;
    },
    async selectDue({ source, cutoffIso, limit }) {
      const { data, error } = await dueFilter(
        supabase
          .from("media_items")
          .select(
            "id, slug, source, kind, external_id, content_hash, normalization_version",
          ),
        source,
        cutoffIso,
      )
        .order("provider_checked_at", { ascending: true, nullsFirst: true })
        .order("id", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`selectDue failed: ${error.message}`);
      return (data ?? []).map((row) => ({
        mediaId: row.id,
        slug: row.slug,
        source: row.source,
        kind: row.kind,
        externalId: row.external_id,
        contentHash: row.content_hash ?? null,
        normalizationVersion: row.normalization_version ?? null,
      }));
    },
    async refresh(args) {
      const { data, error } = await supabase.rpc(
        "refresh_external_media",
        args,
      );
      return {
        data,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
    async markFailed(args) {
      const { data, error } = await supabase.rpc(
        "mark_external_media_refresh_failed",
        args,
      );
      return {
        data,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
    async markRemoved(args) {
      const { data, error } = await supabase.rpc(
        "mark_external_media_removed",
        args,
      );
      return {
        data,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
  };
}

const exitCode = await runRefreshCatalog(process.argv.slice(2), {
  env: process.env,
  buildRegistry: ({ fake }) =>
    fake
      ? createProviderRegistry([
          createFakeProvider({ id: "tmdb" }),
          createFakeProvider({ id: "openlibrary" }),
        ])
      : createServerProviderRegistry(),
  createStore,
  logger: {
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
  },
});

process.exit(exitCode);
