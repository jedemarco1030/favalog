// Favalog AI Discovery — retrieval evaluation harness.
//
// Scores catalog retrieval over the human-reviewed golden dataset and enforces
// committed quality thresholds (non-zero exit on regression). It compares a
// keyword baseline against hybrid retrieval so the value of the semantic arm is
// measurable, not asserted.
//
// Modes:
//   node scripts/eval-search.mjs            # deterministic: fake query embeddings
//                                           # (secret-free) + keyword baseline, vs local DB
//   node scripts/eval-search.mjs --live     # live: OpenAI query embeddings (needs OPENAI_API_KEY)
//   node scripts/eval-search.mjs --json     # emit machine-readable JSON only
//
// Requires local Supabase (like `npm run db:test`) with embeddings populated
// (`npm run embed:catalog -- --fake` for deterministic mode). Never claims live
// semantic quality unless the OpenAI-backed run genuinely executed.
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and a key (SUPABASE_SECRET_KEY
// or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); OPENAI_API_KEY only for --live.

import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { FakeEmbeddingProvider } from "../lib/search/embedding-provider.ts";
import { createOpenAIEmbeddingProvider } from "../lib/search/openai-embedding-provider.ts";
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

  const keywordResults = await runArm(supabase, "keyword_search", (c) => ({
    p_query: c.query,
    p_kind: c.kind ?? undefined,
    p_limit: 24,
  }));

  const hybridResults = await runArm(supabase, "hybrid_search", async (c) => {
    const embedding = await provider.embed([c.query]);
    return {
      p_query: c.query,
      p_query_embedding: JSON.stringify(embedding.vectors[0]),
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
    thresholds: DEFAULT_THRESHOLDS,
    keyword: keywordMetrics,
    hybrid: hybridMetrics,
    thresholdCheck: check,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[eval:search] mode: ${mode}`);
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
