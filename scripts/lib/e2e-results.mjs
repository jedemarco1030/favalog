export function summarizeReport(report) {
  const files = {};
  const skippedTests = [];
  const invalidTests = [];
  const visit = (suite, inherited = "") => {
    const file = suite.file ?? inherited;
    for (const spec of suite.specs ?? []) {
      const specFile = spec.file ?? file;
      const entry = (files[specFile] ??= {
        executed: 0,
        skipped: 0,
        failed: 0,
        flaky: 0,
        retried: 0,
        attempts: 0,
        firstAttemptPasses: 0,
      });
      for (const test of spec.tests ?? []) {
        const journey = `${specFile}::${spec.title ?? ""}`;
        const results = test.results ?? [];
        entry.attempts += results.length;
        if (test.status === "skipped") {
          entry.skipped++;
          skippedTests.push(journey);
        } else if (
          ["expected", "unexpected", "flaky"].includes(test.status) &&
          results.length > 0 &&
          results.some((r) =>
            ["passed", "failed", "timedOut", "interrupted"].includes(r.status),
          )
        ) {
          entry.executed++;
          if (
            test.status === "unexpected" ||
            !results.some((r) => r.status === "passed")
          )
            entry.failed++;
          if (test.status === "flaky") entry.flaky++;
          if (results.length > 1 || results.some((r) => r.retry > 0))
            entry.retried++;
          if (
            results.length === 1 &&
            results[0].status === "passed" &&
            !results[0].retry
          )
            entry.firstAttemptPasses++;
        } else invalidTests.push(journey);
      }
    }
    for (const child of suite.suites ?? []) visit(child, file);
  };
  for (const suite of report.suites ?? []) visit(suite);
  const totals = {
    executed: 0,
    skipped: 0,
    failed: 0,
    flaky: 0,
    retried: 0,
    attempts: 0,
    firstAttemptPasses: 0,
  };
  for (const entry of Object.values(files)) {
    for (const key of Object.keys(totals)) totals[key] += entry[key];
  }
  return {
    files,
    ...totals,
    skippedTests,
    invalidTests,
    errors: report.errors ?? [],
  };
}

/**
 * @param {ReturnType<typeof summarizeReport>} summary
 * @param {{ requiredSpecs: string[], minExecuted: number, allowedSkips?: string[], maxRetried?: number }} rules
 */
export function findCoverageProblems(
  summary,
  { requiredSpecs, minExecuted, allowedSkips = [], maxRetried = Infinity },
) {
  const problems = [];
  if (summary.executed < minExecuted)
    problems.push(
      `expected at least ${minExecuted} executed tests, got ${summary.executed}`,
    );
  for (const spec of requiredSpecs) {
    const match = Object.entries(summary.files).find(
      ([file]) => file === spec || file.endsWith(`/${spec}`),
    );
    if (!match)
      problems.push(`required spec ${spec} did not appear in the report`);
    else if (match[1].executed === 0)
      problems.push(
        `required spec ${spec} executed 0 tests (${match[1].skipped} skipped)`,
      );
  }
  for (const test of summary.skippedTests) {
    if (!allowedSkips.includes(test))
      problems.push(`unapproved skipped journey: ${test}`);
  }
  for (const test of summary.invalidTests)
    problems.push(`no usable execution results: ${test}`);
  if (summary.errors.length)
    problems.push(`${summary.errors.length} Playwright runner error(s)`);
  if (summary.failed > 0) problems.push(`${summary.failed} test(s) failed`);
  if (summary.retried > maxRetried)
    problems.push(`${summary.retried} retried test(s), allowed ${maxRetried}`);
  return problems;
}
