import { describe, expect, it } from "vitest";

import {
  compareThresholds,
  evaluate,
  isTop1Relevant,
  recallAtK,
  reciprocalRank,
  type CaseResult,
  type EvalThresholds,
  type GoldenCase,
} from "@/lib/search/eval/metrics";

function makeCase(overrides: Partial<GoldenCase> = {}): GoldenCase {
  return {
    id: "case-1",
    query: "luminous drama",
    relevantSlugs: ["afterglow"],
    rationale: "the definitive match",
    tags: ["theme"],
    ...overrides,
  };
}

describe("recallAtK", () => {
  it("computes hits divided by the relevant-set size", () => {
    const relevant = new Set(["a", "b", "c", "d"]);
    expect(recallAtK(["a", "b", "x", "y"], relevant, 10)).toBe(2 / 4);
  });

  it("respects the k cutoff", () => {
    const relevant = new Set(["a", "b"]);
    // "b" sits outside the top-1 window, so only "a" counts.
    expect(recallAtK(["a", "z", "b"], relevant, 1)).toBe(1 / 2);
  });

  it("returns 0 when the relevant set is empty", () => {
    expect(recallAtK(["a", "b"], new Set<string>(), 5)).toBe(0);
  });
});

describe("reciprocalRank", () => {
  it("is 1/rank of the first relevant hit", () => {
    const relevant = new Set(["b"]);
    expect(reciprocalRank(["a", "b", "c"], relevant)).toBe(1 / 2);
  });

  it("is 1 when the first result is relevant", () => {
    expect(reciprocalRank(["a"], new Set(["a"]))).toBe(1);
  });

  it("is 0 when no result is relevant", () => {
    expect(reciprocalRank(["x", "y"], new Set(["a"]))).toBe(0);
  });
});

describe("isTop1Relevant", () => {
  it("is true when the first retrieved slug is relevant", () => {
    expect(isTop1Relevant(["a", "b"], new Set(["a"]))).toBe(true);
  });

  it("is false when the first slug is not relevant or nothing was retrieved", () => {
    expect(isTop1Relevant(["b", "a"], new Set(["a"]))).toBe(false);
    expect(isTop1Relevant([], new Set(["a"]))).toBe(false);
  });
});

describe("evaluate", () => {
  function buildResults(): CaseResult[] {
    return [
      // Exact-title case: top-1 relevant.
      {
        case: makeCase({
          id: "exact",
          relevantSlugs: ["afterglow"],
          tags: ["exact-title"],
        }),
        retrieved: ["afterglow", "northlight"],
        latencyMs: 100,
      },
      // Themed case: relevant hit at rank 2.
      {
        case: makeCase({ id: "theme", relevantSlugs: ["b"], tags: ["theme"] }),
        retrieved: ["x", "b", "c"],
        latencyMs: 200,
      },
      // Genre case that returns nothing (zero-result).
      {
        case: makeCase({ id: "genre", relevantSlugs: ["g"], tags: ["genre"] }),
        retrieved: [],
        latencyMs: 300,
      },
      // Negative case: no relevant slugs, correctly returns nothing.
      {
        case: makeCase({
          id: "negative",
          relevantSlugs: [],
          tags: ["negative"],
        }),
        retrieved: [],
        latencyMs: 400,
      },
    ];
  }

  it("excludes negative cases from the scored set", () => {
    const metrics = evaluate(buildResults());
    // 4 total cases, 3 with a non-empty relevant set (exact, theme, genre).
    expect(metrics.cases).toBe(4);
    expect(metrics.scoredCases).toBe(3);
    expect(metrics.negativeCases).toBe(1);
  });

  it("computes recall@5 and mrr means over scored cases", () => {
    const metrics = evaluate(buildResults());
    // recall: exact=1, theme=1, genre=0 -> mean 2/3.
    expect(metrics.recallAt5).toBeCloseTo(2 / 3, 6);
    // rr: exact=1, theme=0.5, genre=0 -> mean 1.5/3 = 0.5.
    expect(metrics.mrr).toBeCloseTo(0.5, 6);
  });

  it("computes exact-title top-1 accuracy", () => {
    const metrics = evaluate(buildResults());
    expect(metrics.exactTitleCases).toBe(1);
    expect(metrics.exactTitleTop1Accuracy).toBe(1);
  });

  it("computes zero-result rate and negative-clean rate", () => {
    const metrics = evaluate(buildResults());
    // Two of four cases returned nothing (genre + negative).
    expect(metrics.zeroResultRate).toBeCloseTo(2 / 4, 6);
    // The single negative case correctly returned nothing.
    expect(metrics.negativeCleanRate).toBe(1);
  });

  it("rolls up per-tag metrics for scored tags", () => {
    const metrics = evaluate(buildResults());
    expect(Object.keys(metrics.perTag).sort()).toEqual(
      ["exact-title", "genre", "theme"].sort(),
    );
    // The negative tag has no scored cases, so it is not rolled up.
    expect(metrics.perTag).not.toHaveProperty("negative");
  });

  it("summarizes latency when latencies are recorded", () => {
    const metrics = evaluate(buildResults());
    expect(metrics.latency).toBeDefined();
    expect(metrics.latency?.count).toBe(4);
    expect(metrics.latency?.avgMs).toBeCloseTo((100 + 200 + 300 + 400) / 4, 6);
    expect(typeof metrics.latency?.p50Ms).toBe("number");
    expect(typeof metrics.latency?.p95Ms).toBe("number");
  });

  it("omits the latency summary when no latencies are provided", () => {
    const metrics = evaluate([{ case: makeCase(), retrieved: ["afterglow"] }]);
    expect(metrics.latency).toBeUndefined();
  });
});

describe("compareThresholds", () => {
  const passingMetrics = {
    cases: 3,
    scoredCases: 3,
    recallAt5: 0.9,
    mrr: 0.8,
    exactTitleCases: 1,
    exactTitleTop1Accuracy: 1,
    zeroResultRate: 0.05,
    negativeCases: 0,
    negativeCleanRate: 1,
    perTag: {},
  };

  const thresholds: EvalThresholds = {
    minRecallAt5: 0.7,
    minMrr: 0.6,
    minExactTitleTop1Accuracy: 0.9,
    maxZeroResultRate: 0.1,
  };

  it("passes with no failures when all gates are met", () => {
    const result = compareThresholds(passingMetrics, thresholds);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails with a non-empty failures list when gates are violated", () => {
    const result = compareThresholds(
      {
        ...passingMetrics,
        recallAt5: 0.5,
        mrr: 0.4,
        exactTitleTop1Accuracy: 0.5,
        zeroResultRate: 0.5,
      },
      thresholds,
    );
    expect(result.pass).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    // Every gate contributed a failure line.
    expect(result.failures).toHaveLength(4);
  });
});
