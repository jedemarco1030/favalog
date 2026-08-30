// Favalog Catalog Platform v1A — operator CLI entrypoint (thin wrapper).
//
// Exercise the trusted external-catalog foundation from the command line WITHOUT
// a UI. All safety-critical logic (argument parsing, remote-target
// classification, the write-authorization guard, orchestration) lives in the
// tested `scripts/catalog-import-core.ts`; this file only wires the real
// Supabase client and provider registry.
//
// Usage:
//   node scripts/catalog-import.mjs search  --provider tmdb --query "dune"
//   node scripts/catalog-import.mjs inspect --provider tmdb --kind movie --external-id 693134
//   node scripts/catalog-import.mjs import  --provider tmdb --kind movie --external-id 693134 --dry-run
//   node scripts/catalog-import.mjs import  --provider tmdb --kind movie --external-id 693134   # local write
//   node scripts/catalog-import.mjs search  --provider tmdb --query "fixture" --fake  # offline
//
// REMOTE SAFETY (see ADR 0003/0004): an import against a hosted Supabase project
// requires BOTH --allow-remote AND --confirm-project-ref=<exact-ref>; a remote
// --fake write is always rejected. Env: TMDB_API_READ_TOKEN,
// OPEN_LIBRARY_CONTACT_EMAIL (live providers), SUPABASE_URL + SUPABASE_SECRET_KEY
// (imports).

import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { createFakeProvider } from "../lib/catalog/fake-provider.ts";
import {
  createProviderRegistry,
  createServerProviderRegistry,
} from "../lib/catalog/provider-registry.ts";
import { runCatalogCli } from "./catalog-import-core.ts";

// Best-effort: load .env.local so local runs pick up provider/Supabase config.
try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  // Ignore — env may be provided by the shell/CI instead.
}

const exitCode = await runCatalogCli(process.argv.slice(2), {
  env: process.env,
  buildRegistry: ({ fake }) =>
    fake
      ? createProviderRegistry([
          createFakeProvider({ id: "tmdb" }),
          createFakeProvider({ id: "openlibrary" }),
        ])
      : createServerProviderRegistry(),
  createSupabaseClient: (url, key) =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  logger: {
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
  },
});

process.exit(exitCode);
