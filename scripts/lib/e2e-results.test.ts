import { describe, expect, it } from "vitest";

import { findCoverageProblems, summarizeReport } from "./e2e-results.mjs";

const report = {
  suites: [
    {
      file: "likes.spec.ts",
      specs: [{ tests: [{ status: "expected" }, { status: "flaky" }] }],
    },
    {
      file: "feed.spec.ts",
      suites: [{ specs: [{ tests: [{ status: "skipped" }] }] }],
    },
    {
      file: "save.spec.ts",
      specs: [{ tests: [{ status: "unexpected" }] }],
    },
  ],
};

describe("summarizeReport", () => {
  it("counts executed, skipped, and failed tests per spec file, including nested suites", () => {
    const summary = summarizeReport(report);
    expect(summary.files["likes.spec.ts"]).toEqual({
      executed: 2,
      skipped: 0,
      failed: 0,
    });
    expect(summary.files["feed.spec.ts"]).toEqual({
      executed: 0,
      skipped: 1,
      failed: 0,
    });
    expect(summary).toMatchObject({ executed: 3, skipped: 1, failed: 1 });
  });
});

describe("findCoverageProblems", () => {
  it("flags a required spec whose tests were all skipped", () => {
    const summary = summarizeReport(report);
    expect(
      findCoverageProblems(summary, {
        requiredSpecs: ["likes.spec.ts", "feed.spec.ts"],
        minExecuted: 1,
      }),
    ).toEqual([
      "required spec feed.spec.ts executed 0 tests (1 skipped)",
      "1 test(s) failed",
    ]);
  });

  it("flags a required spec that is missing and a too-low total", () => {
    const summary = summarizeReport({ suites: [] });
    expect(
      findCoverageProblems(summary, {
        requiredSpecs: ["likes.spec.ts"],
        minExecuted: 5,
      }),
    ).toEqual([
      "expected at least 5 executed tests, got 0",
      "required spec likes.spec.ts did not appear in the report",
    ]);
  });

  it("passes when every required spec executed", () => {
    const summary = summarizeReport({
      suites: [
        {
          file: "e2e/likes.spec.ts",
          specs: [{ tests: [{ status: "expected" }] }],
        },
      ],
    });
    expect(
      findCoverageProblems(summary, {
        requiredSpecs: ["likes.spec.ts"],
        minExecuted: 1,
      }),
    ).toEqual([]);
  });
});
