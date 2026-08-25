// Favalog AI Discovery — retrieval evaluation harness.
//
// Scores catalog retrieval over the human-reviewed golden dataset and enforces
// committed quality thresholds (non-zero exit on regression). It compares a
// keyword baseline against hybrid retrieval so the value of the semantic arm is
// measurable, not asserted.
//
// Modes:
//   node scripts/eval-search.mjs            # DETERMINISTIC: fake query embeddings
//                                           # (secret-free) + keyword baseline, vs local DB
//   node scripts/eval-search.mjs --live     # LIVE: OpenAI query embeddings (needs OPENAI_API_KEY)
//   node scripts/eval-search.mjs --json     # emit machine-readable JSON only
//
// Requires local Supabase (like `npm run db:test`) with embeddings populated
// (`npm run embed:catalog -- --fake` for deterministic mode).
//
// FAIL-CLOSED PROVENANCE GATE: before any hybrid evaluation the harness confirms
// that EVERY catalog title has a stored embedding matching the ACTIVE identity
// (provider/model/dimensions/document version). In --live mode, if any fake,
// stale, incomplete, or otherwise incompatible catalog vectors remain, it exits
// NON-ZERO before evaluating and never reports live semantic metrics for a
// mismatched corpus. The report always includes the evaluated identity and the
// compatible-corpus count.
//
// HONEST LABELING: the deterministic (fake) mode is a SECRET-FREE integration /
// regression evaluation of the retrieval plumbing — it is NOT proof of semantic
// relevance. Only a genuine --live OpenAI run is evidence of semantic quality.
// Keys and raw vectors are never logged.
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and a key (SUPABASE_SECRET_KEY
// or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); OPENAI_API_KEY only for --live.

import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { FakeEmbeddingProvider } from "../lib/search/embedding-provider.ts";
import { createOpenAIEmbeddingProvider } from "../lib/search/openai-embedding-provider.ts";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER_ID,
} from "../lib/search/config.ts";
import { CANONICAL_DOCUMENT_VERSION } from "../lib/search/canonical-document.ts";
import { compareThresholds, evaluate } from "../lib/search/eval/metrics.ts";
import {
  DEFAULT_THRESHOLDS,
  GOLDEN_CASES,
} from "../lib/search/eval/golden-dataset.ts";

try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  /* env may come from the shell/CI */
}

function parseArgs(argv) {
  return {
    live: argv.includes("--live"),
    json: argv.includes("--json"),
  };
}

async function runArm(supabase, rpc, buildArgs) {
  const results = [];
  for (const testCase of GOLDEN_CASES) {
    const started = performance.now();
    const args = await buildArgs(testCase);
    const { data, error } = await supabase.rpc(rpc, args);
    const latencyMs = performance.now() - started;
    if (error)
      throw new Error(`${rpc} failed for "${testCase.id}": ${error.message}`);
    results.push({
      case: testCase,
      retrieved: (data ?? []).map((row) => row.slug),
      latencyMs,
    });
  }
  return results;
}

function printSummary(label, metrics) {
  console.log(`\n=== ${label} ===`);
  console.log(
    `  cases:                ${metrics.cases} (scored ${metrics.scoredCases})`,
  );
  console.log(`  recall@5:             ${metrics.recallAt5.toFixed(3)}`);
  console.log(`  MRR:                  ${metrics.mrr.toFixed(3)}`);
  console.log(
    `  exact-title top-1:    ${metrics.exactTitleTop1Accuracy.toFixed(3)} ` +
      `(${metrics.exactTitleCases} cases)`,
  );
  console.log(`  zero-result rate:     ${metrics.zeroResultRate.toFixed(3)}`);
  console.log(
    `  negative clean rate:  ${metrics.negativeCleanRate.toFixed(3)} ` +
      `(${metrics.negativeCases} cases)`,
  );
  if (metrics.latency) {
    console.log(
      `  latency ms (avg/p50/p95): ${metrics.latency.avgMs.toFixed(1)} / ` +
        `${metrics.latency.p50Ms.toFixed(1)} / ${metrics.latency.p95Ms.toFixed(1)}`,
    );
  }
  const cats = Object.entries(metrics.perTag)
    .map(([tag, m]) => `${tag}:${m.recallAt5.toFixed(2)}`)
    .join("  ");
  console.log(`  per-category recall@5: ${cats}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!url || !key) {
    console.error(
      "[eval:search] Missing Supabase config (SUPABASE_URL + a key). " +
        "Start local Supabase and populate embeddings first.",
    );
    process.exit(1);
  }

  // Resolve the query-embedding provider for the hybrid arm.
  let provider;
  let mode;
  if (args.live) {
    const providerResult = createOpenAIEmbeddingProvider();
    if (!providerResult.ok) {
      console.error(
        "[eval:search] SKIPPED live evaluation: OPENAI_API_KEY is not configured. " +
          "No live semantic quality is claimed. Run without --live for the deterministic baseline.",
      );
      process.exit(0);
    }
    provider = providerResult.provider;
    mode = "live-hybrid (OpenAI)";
  } else {
    provider = new FakeEmbeddingProvider();
    mode = "deterministic-hybrid (fake embeddings)";
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The embedding identity these results will be evaluated against. In --live
  // mode this is the real OpenAI identity; in deterministic mode it is the fake
  // provider's identity (which is what `embed:catalog --fake` wrote).
  const identity = args.live
    ? {
        provider: EMBEDDING_PROVIDER_ID,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        documentVersion: CANONICAL_DOCUMENT_VERSION,
      }
    : {
        provider: provider.id,
        model: provider.model,
        dimensions: provider.dimensions,
        documentVersion: CANONICAL_DOCUMENT_VERSION,
      };

  // --- Fail-closed provenance gate -----------------------------------------
  const { count: catalogCount, error: catalogError } = await supabase
    .from("media_items")
    .select("*", { count: "exact", head: true });
  if (catalogError) {
    console.error(
      `[eval:search] Failed to count the catalog: ${catalogError.message}`,
    );
    process.exit(1);
  }
  const { data: compatibleCount, error: compatError } = await supabase.rpc(
    "compatible_embedding_count",
    {
      p_provider: identity.provider,
      p_model: identity.model,
      p_dimensions: identity.dimensions,
      p_document_version: identity.documentVersion,
    },
  );
  if (compatError) {
    console.error(
      `[eval:search] Failed to read the compatible-corpus count: ${compatError.message}`,
    );
    process.exit(1);
  }
  const compatible = Number(compatibleCount ?? 0);
  const corpusComplete = catalogCount > 0 && compatible >= catalogCount;

  if (args.live && !corpusComplete) {
    console.error(
      `[eval:search] FAIL-CLOSED: the stored catalog embeddings are not a complete ` +
        `match for the active identity (provider=${identity.provider}, ` +
        `model=${identity.model}, dimensions=${identity.dimensions}, ` +
        `document_version=${identity.documentVersion}). ` +
        `compatible ${compatible}/${catalogCount}. ` +
        `Re-run \`npm run embed:catalog\` to backfill real embeddings; ` +
        `no live semantic metrics are reported for a mismatched corpus.`,
    );
    process.exit(1);
  }

  const keywordResults = await runArm(supabase, "keyword_search", (c) => ({
    p_query: c.query,
    p_kind: c.kind ?? undefined,
    p_limit: 24,
  }));

  let embeddingTokens = 0;
  const hybridResults = await runArm(supabase, "hybrid_search", async (c) => {
    const embedding = await provider.embed([c.query]);
    embeddingTokens += embedding.usage?.totalTokens ?? 0;
    return {
      p_query: c.query,
      p_query_embedding: JSON.stringify(embedding.vectors[0]),
      p_provider: identity.provider,
      p_model: identity.model,
      p_dimensions: identity.dimensions,
      p_document_version: identity.documentVersion,
      p_kind: c.kind ?? undefined,
      p_limit: 24,
    };
  });

  const keywordMetrics = evaluate(keywordResults);
  const hybridMetrics = evaluate(hybridResults);
  const check = compareThresholds(hybridMetrics, DEFAULT_THRESHOLDS);

  const report = {
    event: "eval_search_report",
    mode,
    live: args.live,
    // The deterministic mode is a secret-free integration/regression check of the
    // retrieval plumbing, NOT evidence of semantic relevance. Only --live is.
    evaluationKind: args.live
      ? "live-semantic-quality"
      : "deterministic-integration-regression (secret-free; NOT semantic-quality evidence)",
    identity,
    catalogCount,
    compatibleCorpusCount: compatible,
    corpusComplete,
    embeddingTokens,
    thresholds: DEFAULT_THRESHOLDS,
    keyword: keywordMetrics,
    hybrid: hybridMetrics,
    thresholdCheck: check,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[eval:search] mode: ${mode}`);
    console.log(`[eval:search] evaluation kind: ${report.evaluationKind}`);
    console.log(
      `[eval:search] identity: provider=${identity.provider} model=${identity.model} ` +
        `dimensions=${identity.dimensions} document_version=${identity.documentVersion}`,
    );
    console.log(
      `[eval:search] compatible corpus: ${compatible}/${catalogCount}` +
        (args.live ? ` (embedding tokens: ${embeddingTokens})` : ""),
    );
    if (!args.live) {
      console.log(
        "[eval:search] NOTE: deterministic fake mode is a secret-free integration/" +
          "regression check — NOT proof of semantic relevance.",
      );
    }
    printSummary("Keyword baseline", keywordMetrics);
    printSummary(`Hybrid (${mode})`, hybridMetrics);
    console.log(
      `\n[eval:search] threshold check: ${check.pass ? "PASS" : "FAIL"}` +
        (check.failures.length ? ` — ${check.failures.join("; ")}` : ""),
    );
    console.log(JSON.stringify(report));
  }

  process.exit(check.pass ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[eval:search] Failed: ${message}`);
  process.exit(1);
});
