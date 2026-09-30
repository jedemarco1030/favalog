/**
 * Summarize a Playwright JSON report so CI can prove which suites EXECUTED,
 * not merely which were configured. A green run where a required spec had
 * every test skipped (a missing env var, a wrong grep) must fail loudly.
 */

/**
 * @typedef {{ status?: string }} PwTest
 * @typedef {{ file?: string, tests?: PwTest[] }} PwSpec
 * @typedef {{ file?: string, specs?: PwSpec[], suites?: PwSuite[] }} PwSuite
 * @typedef {{ suites?: PwSuite[] }} PwReport
 */

/**
 * @param {PwReport} report
 * @returns {{ files: Record<string, { executed: number, skipped: number, failed: number }>, executed: number, skipped: number, failed: number }}
 */
export function summarizeReport(report) {
  /** @type {Record<string, { executed: number, skipped: number, failed: number }>} */
  const files = {};
  const visit = (
    /** @type {PwSuite} */ suite,
    /** @type {string} */ inherited,
  ) => {
    const file = suite.file ?? inherited;
    for (const spec of suite.specs ?? []) {
      const specFile = spec.file ?? file;
      const entry = (files[specFile] ??= {
        executed: 0,
        skipped: 0,
        failed: 0,
      });
      for (const test of spec.tests ?? []) {
        if (test.status === "skipped") entry.skipped += 1;
        else {
          entry.executed += 1;
          if (test.status === "unexpected") entry.failed += 1;
        }
      }
    }
    for (const child of suite.suites ?? []) visit(child, file);
  };
  for (const suite of report.suites ?? []) visit(suite, suite.file ?? "");

  const totals = Object.values(files).reduce(
    (sum, f) => ({
      executed: sum.executed + f.executed,
      skipped: sum.skipped + f.skipped,
      failed: sum.failed + f.failed,
    }),
    { executed: 0, skipped: 0, failed: 0 },
  );
  return { files, ...totals };
}

/**
 * @param {ReturnType<typeof summarizeReport>} summary
 * @param {{ requiredSpecs: string[], minExecuted: number }} rules
 * @returns {string[]} human-readable problems; empty means the gate passes
 */
export function findCoverageProblems(summary, { requiredSpecs, minExecuted }) {
  const problems = [];
  if (summary.executed < minExecuted) {
    problems.push(
      `expected at least ${minExecuted} executed tests, got ${summary.executed}`,
    );
  }
  for (const spec of requiredSpecs) {
    const match = Object.entries(summary.files).find(
      ([file]) => file === spec || file.endsWith(`/${spec}`),
    );
    if (!match)
      problems.push(`required spec ${spec} did not appear in the report`);
    else if (match[1].executed === 0) {
      problems.push(
        `required spec ${spec} executed 0 tests (${match[1].skipped} skipped)`,
      );
    }
  }
  if (summary.failed > 0) problems.push(`${summary.failed} test(s) failed`);
  return problems;
}
