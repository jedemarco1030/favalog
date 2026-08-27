// Favalog AI Discovery — local/server-only embedding pipeline CLI (entrypoint).
//
// Reads the catalog from public.media_items, builds each title's canonical
// document (the SAME versioned builder + hash the app uses), selects the missing
// or stale ones, embeds them in bounded batches with retry, and upserts the
// vectors into the private public.media_search_documents table.
//
// This runs ONLY when invoked explicitly (never during migrations, builds,
// tests, page rendering, or a db reset). It is a thin wrapper: all drift- and
// SAFETY-critical logic (argument parsing, LOCAL-vs-REMOTE target
// classification, the write-authorization guard, and orchestration) lives in
// the tested `scripts/embed-catalog-core.ts`, which is imported here and wired
// to the real Supabase client, providers, and pipeline.
//
// Usage:
//   node scripts/embed-catalog.mjs            # embed missing/stale (needs OPENAI_API_KEY)
//   node scripts/embed-catalog.mjs --dry-run  # report what WOULD be embedded (no key/writes)
//   node scripts/embed-catalog.mjs --fake     # deterministic local vectors (no key) — dev only
//   node scripts/embed-catalog.mjs --limit 5  # cap catalog rows processed
//   node scripts/embed-catalog.mjs --force    # re-embed every row (recovery only)
//
// REMOTE SAFETY (see ADR 0003): writing to a hosted Supabase project is guarded.
//   - A remote --fake write ALWAYS fails (even with --force).
//   - A remote live write fails UNLESS you pass BOTH:
//       --allow-remote --confirm-project-ref=<exact-project-ref>
//     where <exact-project-ref> matches the resolved Supabase URL.
//   - --force never bypasses remote protection; remote dry runs stay write-free.
//   Example (owner-operated, deliberate hosted backfill):
//     node scripts/embed-catalog.mjs --allow-remote --confirm-project-ref=abcd1234efgh5678
//
// Staleness is driven by the COMPLETE embedding identity, not just the content
// hash: a stored row is skipped only when its content hash, document version,
// embedding provider, embedding model, and embedding dimensions all match what
// this run would produce and a full embedding is present. Any mismatch (e.g.
// fake rows facing a real OpenAI run) is re-embedded automatically; --force is a
// recovery escape hatch that never substitutes for that detection.
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SECRET_KEY (or
// SUPABASE_SERVICE_ROLE_KEY), and OPENAI_API_KEY (unless --dry-run/--fake).

import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { createOpenAIEmbeddingProvider } from "../lib/search/openai-embedding-provider.ts";
import { FakeEmbeddingProvider } from "../lib/search/embedding-provider.ts";
import { runEmbeddingPipeline } from "../lib/search/pipeline.ts";
import { runEmbedCatalog } from "./embed-catalog-core.ts";

// Best-effort: load .env.local so local runs pick up Supabase/OpenAI config.
try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  // Ignore — env may be provided by the shell/CI instead.
}

const exitCode = await runEmbedCatalog(process.argv.slice(2), {
  env: process.env,
  createSupabaseClient: (url, key) =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  createFakeProvider: () => new FakeEmbeddingProvider(),
  createOpenAIProvider: () => createOpenAIEmbeddingProvider(),
  runPipeline: runEmbeddingPipeline,
  logger: {
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
  },
});

process.exit(exitCode);
