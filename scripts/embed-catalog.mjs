// Favalog AI Discovery — local/server-only embedding pipeline CLI.
//
// Reads the catalog from public.media_items, builds each title's canonical
// document (the SAME versioned builder + hash the app uses), selects the missing
// or stale ones, embeds them in bounded batches with retry, and upserts the
// vectors into the private public.media_search_documents table.
//
// This runs ONLY when invoked explicitly (never during migrations, builds,
// tests, page rendering, or a db reset). It is a thin wrapper around the tested
// pipeline core in lib/search/pipeline.ts; the drift-critical pieces (document
// format, content hash, model/dimension constants, error classification) are
// imported from the shared TypeScript modules, not reimplemented.
//
// Usage:
//   node scripts/embed-catalog.mjs            # embed missing/stale (needs OPENAI_API_KEY)
//   node scripts/embed-catalog.mjs --dry-run  # report what WOULD be embedded (no key/writes)
//   node scripts/embed-catalog.mjs --fake     # deterministic local vectors (no key) — dev only
//   node scripts/embed-catalog.mjs --limit 5  # cap catalog rows processed
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SECRET_KEY (or
// SUPABASE_SERVICE_ROLE_KEY), and OPENAI_API_KEY (unless --dry-run/--fake).

import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import {
  CANONICAL_DOCUMENT_VERSION,
  canonicalDocumentFor,
} from "../lib/search/canonical-document.ts";
import { createOpenAIEmbeddingProvider } from "../lib/search/openai-embedding-provider.ts";
import { FakeEmbeddingProvider } from "../lib/search/embedding-provider.ts";
import { runEmbeddingPipeline } from "../lib/search/pipeline.ts";

// Best-effort: load .env.local so local runs pick up Supabase/OpenAI config.
try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  // Ignore — env may be provided by the shell/CI instead.
}

function parseArgs(argv) {
  const args = { dryRun: false, fake: false, limit: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--fake") args.fake = true;
    else if (arg === "--limit") args.limit = Number.parseInt(argv[++i], 10);
  }
  return args;
}

/** Build a MediaItem-shaped object from a media_items row for the doc builder. */
function rowToMediaItem(row) {
  const details =
    row.details && typeof row.details === "object" ? row.details : {};
  const base = {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    synopsis: row.synopsis ?? "",
    year: row.year,
    posterUrl: row.poster_url ?? "",
    genres: Array.isArray(row.genres) ? row.genres : [],
  };
  if (row.kind === "movie") {
    return {
      ...base,
      runtimeMinutes: details.runtimeMinutes ?? 0,
      director: details.director ?? "",
      cast: Array.isArray(details.cast) ? details.cast : [],
    };
  }
  if (row.kind === "tv") {
    return {
      ...base,
      seasons: details.seasons ?? 0,
      episodes: details.episodes ?? 0,
      creators: Array.isArray(details.creators) ? details.creators : [],
      status: details.status ?? "ongoing",
    };
  }
  return {
    ...base,
    authors: Array.isArray(details.authors) ? details.authors : [],
    pageCount: details.pageCount ?? 0,
    publisher: details.publisher ?? undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !serviceKey) {
    console.error(
      "[embed-catalog] Missing Supabase config. Set SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY (service-role) to read the catalog and write embeddings.",
    );
    process.exit(1);
  }

  // Resolve the embedding provider (or exit cleanly when no key + not dry/fake).
  let provider;
  if (args.fake) {
    provider = new FakeEmbeddingProvider();
    console.warn(
      "[embed-catalog] Using the DETERMINISTIC FAKE provider (dev only).",
    );
  } else {
    const providerResult = createOpenAIEmbeddingProvider();
    if (!providerResult.ok) {
      if (args.dryRun) {
        // Dry run never calls the provider; a placeholder is safe.
        provider = new FakeEmbeddingProvider();
      } else {
        console.error(
          "[embed-catalog] OPENAI_API_KEY is not configured. Set it to embed, " +
            "or run with --dry-run to preview, or --fake for deterministic local vectors.",
        );
        process.exit(0);
      }
    } else {
      provider = providerResult.provider;
    }
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Read the catalog.
  let query = supabase
    .from("media_items")
    .select("id, slug, kind, title, subtitle, synopsis, year, genres, details")
    .order("slug", { ascending: true });
  if (Number.isFinite(args.limit)) query = query.limit(args.limit);

  const { data: rows, error: readError } = await query;
  if (readError) {
    console.error(
      `[embed-catalog] Failed to read catalog: ${readError.message}`,
    );
    process.exit(1);
  }

  const records = (rows ?? []).map((row) => {
    const { document, contentHash } = canonicalDocumentFor(rowToMediaItem(row));
    return { mediaId: row.id, slug: row.slug, document, contentHash };
  });

  const store = {
    async loadExisting() {
      const { data, error } = await supabase
        .from("media_search_documents")
        .select("media_id, content_hash, embedded_at");
      if (error) throw new Error(`loadExisting failed: ${error.message}`);
      const existing = new Map();
      for (const row of data ?? []) {
        existing.set(row.media_id, {
          contentHash: row.content_hash,
          hasEmbedding: row.embedded_at !== null,
        });
      }
      return existing;
    },
    async upsert(rowToWrite) {
      const { error } = await supabase.from("media_search_documents").upsert(
        {
          media_id: rowToWrite.mediaId,
          content: rowToWrite.content,
          content_hash: rowToWrite.contentHash,
          document_version: rowToWrite.documentVersion,
          // pgvector accepts the JSON array string form "[...]".
          embedding: JSON.stringify(rowToWrite.embedding),
          embedding_model: rowToWrite.model,
          embedding_provider: rowToWrite.provider,
          embedding_dimensions: rowToWrite.dimensions,
          embedded_at: rowToWrite.embeddedAt,
        },
        { onConflict: "media_id" },
      );
      if (error) throw new Error(`upsert failed: ${error.message}`);
    },
  };

  try {
    const report = await runEmbeddingPipeline(records, store, provider, {
      dryRun: args.dryRun,
      documentVersion: CANONICAL_DOCUMENT_VERSION,
      onProgress: ({ batch, batches, updated, failed }) => {
        console.log(
          `[embed-catalog] batch ${batch}/${batches} — updated ${updated}, failed ${failed}`,
        );
      },
    });

    console.log(
      `[embed-catalog] ${args.dryRun ? "DRY RUN — " : ""}done: ` +
        `attempted ${report.attempted}, updated ${report.updated}, ` +
        `unchanged ${report.unchanged}, failed ${report.failed}, ` +
        `tokens ${report.tokens}, duration ${Math.round(report.durationMs)}ms`,
    );
    console.log(JSON.stringify({ event: "embed_catalog_report", ...report }));
    process.exit(report.failed > 0 ? 2 : 0);
  } catch (error) {
    // Fatal config/auth error (or unexpected). Never print the key.
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[embed-catalog] Stopped: ${message}`);
    process.exit(1);
  }
}

main();
