import { describe, expect, it } from "vitest";
import { findCoverageProblems, summarizeReport } from "./e2e-results.mjs";

const passed = {
  status: "expected",
  results: [{ status: "passed", retry: 0 }],
};
const rules = { requiredSpecs: ["save.spec.ts"], minExecuted: 1 };
const report = (test: object) => ({
  suites: [
    {
      file: "save.spec.ts",
      suites: [{ specs: [{ title: "save", tests: [test] }] }],
    },
  ],
});

describe("Playwright execution evidence", () => {
  it("accepts an actually executed first-attempt pass", () => {
    const summary = summarizeReport(report(passed));
    expect(summary).toMatchObject({
      executed: 1,
      firstAttemptPasses: 1,
      attempts: 1,
      flaky: 0,
      retried: 0,
    });
    expect(findCoverageProblems(summary, rules)).toEqual([]);
  });
  it("does not count configured tests with no results as execution", () => {
    const summary = summarizeReport(report({ status: "expected" }));
    expect(summary.executed).toBe(0);
    expect(findCoverageProblems(summary, rules)).toContain(
      "no usable execution results: save.spec.ts::save",
    );
  });
  it("exposes flakes and retries separately from first-attempt passes", () => {
    const summary = summarizeReport(
      report({
        status: "flaky",
        results: [
          { status: "timedOut", retry: 0 },
          { status: "passed", retry: 1 },
        ],
      }),
    );
    expect(summary).toMatchObject({
      executed: 1,
      flaky: 1,
      retried: 1,
      attempts: 2,
      firstAttemptPasses: 0,
    });
    expect(
      findCoverageProblems(summary, { ...rules, maxRetried: 0 }),
    ).toContain("1 retried test(s), allowed 0");
  });
  it("rejects missing required specs, runner errors and failed tests", () => {
    expect(
      findCoverageProblems(
        summarizeReport({ suites: [], errors: [{ message: "server failed" }] }),
        rules,
      ),
    ).toContain("1 Playwright runner error(s)");
    const summary = summarizeReport(
      report({ status: "unexpected", results: [{ status: "failed" }] }),
    );
    expect(findCoverageProblems(summary, rules)).toContain("1 test(s) failed");
  });
  it("permits only individually named skips and still rejects entirely skipped required specs", () => {
    const summary = summarizeReport(
      report({ status: "skipped", results: [{ status: "skipped" }] }),
    );
    expect(findCoverageProblems(summary, rules)).toContain(
      "unapproved skipped journey: save.spec.ts::save",
    );
    expect(
      findCoverageProblems(summary, {
        ...rules,
        allowedSkips: ["save.spec.ts::save"],
      }),
    ).toEqual([
      "expected at least 1 executed tests, got 0",
      "required spec save.spec.ts executed 0 tests (1 skipped)",
    ]);
  });
});
