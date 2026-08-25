/**
 * Retrieval-quality metrics — pure functions with no I/O.
 *
 * These are the single source of truth for how Favalog scores catalog
 * retrieval, used by both the evaluation runner (`scripts/eval-search.mjs`) and
 * the unit tests. Nothing here mocks the ranking being measured; the runner
 * feeds in real retrieved slug lists and these functions score them.
 */

import type { MediaKind } from "@/lib/types";

/** One human-reviewed evaluation case over the stable curated catalog. */
export interface GoldenCase {
  id: string;
  query: string;
  /** Acceptable relevant slug(s). Empty for a negative case (nothing matches). */
  relevantSlugs: string[];
  /** Optional media-kind filter to apply for this case. */
  kind?: MediaKind;
  /** Why these are the acceptable results (human rationale). */
  rationale: string;
  /** Tags such as exact-title, genre, theme, mood, person, cross-media, negative. */
  tags: string[];
}

/** The ranked retrieval for a single case (slugs, best first). */
export interface CaseResult {
  case: GoldenCase;
  retrieved: string[];
  latencyMs?: number;
}

/** Per-tag rollup. */
export interface TagMetrics {
  cases: number;
  recallAt5: number;
  mrr: number;
}

/** Latency summary (only present when live latencies were recorded). */
export interface LatencySummary {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

/** The aggregate evaluation report. */
export interface EvalMetrics {
  cases: number;
  /** Cases with a non-empty relevant set (used for recall/MRR). */
  scoredCases: number;
  recallAt5: number;
  mrr: number;
  exactTitleCases: number;
  exactTitleTop1Accuracy: number;
  /**
   * Fraction of POSITIVE (scored) cases that returned NO results. A positive
   * query is expected to find something, so a zero result here is a FAILURE.
   * Deliberately kept separate from {@link negativeCleanRate}: a negative query
   * returning nothing is a SUCCESS, and the two must never be conflated.
   */
  positiveZeroResultRate: number;
  negativeCases: number;
  /**
   * Fraction of negative cases that correctly returned NO results. A negative
   * query has no defensible catalog match, so returning nothing is the desired
   * behaviour and a higher rate is BETTER (this is the semantic cutoff /
   * exact-title / keyword contract working as intended).
   */
  negativeCleanRate: number;
  perTag: Record<string, TagMetrics>;
  latency?: LatencySummary;
}

/** Recall@k: fraction of the relevant set found within the top-k retrieved. */
export function recallAtK(
  retrieved: readonly string[],
  relevant: ReadonlySet<string>,
  k: number,
): number {
  if (relevant.size === 0) return 0;
  const top = retrieved.slice(0, Math.max(0, k));
  let hits = 0;
  for (const slug of top) if (relevant.has(slug)) hits += 1;
  return hits / relevant.size;
}

/** Reciprocal rank of the first relevant hit (0 if none present). */
export function reciprocalRank(
  retrieved: readonly string[],
  relevant: ReadonlySet<string>,
): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

/** Whether the top-1 retrieved slug is in the relevant set. */
export function isTop1Relevant(
  retrieved: readonly string[],
  relevant: ReadonlySet<string>,
): boolean {
  return retrieved.length > 0 && relevant.has(retrieved[0]);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function isNegative(c: GoldenCase): boolean {
  return c.tags.includes("negative") || c.relevantSlugs.length === 0;
}

/** Compute the aggregate {@link EvalMetrics} for a set of case results. */
export function evaluate(results: readonly CaseResult[], k = 5): EvalMetrics {
  const scored = results.filter((r) => !isNegative(r.case));
  const exactTitle = results.filter((r) => r.case.tags.includes("exact-title"));
  const negatives = results.filter((r) => isNegative(r.case));

  const recalls = scored.map((r) =>
    recallAtK(r.retrieved, new Set(r.case.relevantSlugs), k),
  );
  const rrs = scored.map((r) =>
    reciprocalRank(r.retrieved, new Set(r.case.relevantSlugs)),
  );

  const exactTop1 = exactTitle.map((r) =>
    isTop1Relevant(r.retrieved, new Set(r.case.relevantSlugs)) ? 1 : 0,
  );

  // Positive-query zero-result rate: only POSITIVE (scored) cases where an empty
  // result is a genuine miss. Negative cases returning nothing are handled by
  // negativeCleanRate below and are never counted as failures here.
  const positiveZeroResults = scored.filter(
    (r) => r.retrieved.length === 0,
  ).length;
  const negativeClean = negatives.filter(
    (r) => r.retrieved.length === 0,
  ).length;

  // Per-tag rollup over scored cases carrying each tag.
  const perTag: Record<string, TagMetrics> = {};
  const tags = new Set<string>();
  for (const r of results) for (const t of r.case.tags) tags.add(t);
  for (const tag of tags) {
    const tagged = scored.filter((r) => r.case.tags.includes(tag));
    if (tagged.length === 0) continue;
    perTag[tag] = {
      cases: tagged.length,
      recallAt5: mean(
        tagged.map((r) =>
          recallAtK(r.retrieved, new Set(r.case.relevantSlugs), k),
        ),
      ),
      mrr: mean(
        tagged.map((r) =>
          reciprocalRank(r.retrieved, new Set(r.case.relevantSlugs)),
        ),
      ),
    };
  }

  const latencies = results
    .map((r) => r.latencyMs)
    .filter((v): v is number => typeof v === "number");
  const latency: LatencySummary | undefined =
    latencies.length > 0
      ? {
          count: latencies.length,
          avgMs: mean(latencies),
          p50Ms: percentile(
            [...latencies].sort((a, b) => a - b),
            50,
          ),
          p95Ms: percentile(
            [...latencies].sort((a, b) => a - b),
            95,
          ),
        }
      : undefined;

  return {
    cases: results.length,
    scoredCases: scored.length,
    recallAt5: mean(recalls),
    mrr: mean(rrs),
    exactTitleCases: exactTitle.length,
    exactTitleTop1Accuracy: mean(exactTop1),
    positiveZeroResultRate:
      scored.length === 0 ? 0 : positiveZeroResults / scored.length,
    negativeCases: negatives.length,
    negativeCleanRate:
      negatives.length === 0 ? 1 : negativeClean / negatives.length,
    perTag,
    ...(latency && { latency }),
  };
}

/** Committed quality thresholds; a run regresses if any is not met. */
export interface EvalThresholds {
  minRecallAt5: number;
  minMrr: number;
  minExactTitleTop1Accuracy: number;
  /** Max fraction of POSITIVE cases allowed to return nothing (a miss). */
  maxPositiveZeroResultRate: number;
  /**
   * Min fraction of NEGATIVE cases that must correctly return nothing. This is
   * the gate that fails when negative-query rejection regresses (e.g. the
   * semantic cutoff is removed and nonsense queries start matching). Target
   * >= 0.80 so the harness does not accept a system that always returns
   * something merely because a vector is closest.
   */
  minNegativeCleanRate: number;
}

/** Compare metrics to thresholds; returns pass + human-readable failures. */
export function compareThresholds(
  metrics: EvalMetrics,
  thresholds: EvalThresholds,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (metrics.recallAt5 < thresholds.minRecallAt5) {
    failures.push(
      `recall@5 ${metrics.recallAt5.toFixed(3)} < ${thresholds.minRecallAt5}`,
    );
  }
  if (metrics.mrr < thresholds.minMrr) {
    failures.push(`mrr ${metrics.mrr.toFixed(3)} < ${thresholds.minMrr}`);
  }
  if (metrics.exactTitleTop1Accuracy < thresholds.minExactTitleTop1Accuracy) {
    failures.push(
      `exactTitleTop1 ${metrics.exactTitleTop1Accuracy.toFixed(3)} < ${thresholds.minExactTitleTop1Accuracy}`,
    );
  }
  if (metrics.positiveZeroResultRate > thresholds.maxPositiveZeroResultRate) {
    failures.push(
      `positiveZeroResultRate ${metrics.positiveZeroResultRate.toFixed(3)} > ${thresholds.maxPositiveZeroResultRate}`,
    );
  }
  if (metrics.negativeCleanRate < thresholds.minNegativeCleanRate) {
    failures.push(
      `negativeCleanRate ${metrics.negativeCleanRate.toFixed(3)} < ${thresholds.minNegativeCleanRate}`,
    );
  }
  return { pass: failures.length === 0, failures };
}
