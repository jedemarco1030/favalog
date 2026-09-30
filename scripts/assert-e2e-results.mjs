#!/usr/bin/env node
/**
 * Usage: node scripts/assert-e2e-results.mjs <report.json> --min=<n>
 *        [--require=<spec.ts> ...]
 *
 * Prints per-spec executed/skipped counts (so job logs show what ran) and
 * exits nonzero if a required spec executed nothing or the total is too low.
 */

import { readFileSync } from "node:fs";

import { findCoverageProblems, summarizeReport } from "./lib/e2e-results.mjs";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error(
    "Usage: assert-e2e-results.mjs <report.json> --min=<n> [--require=<spec>]",
  );
  process.exit(2);
}
const minExecuted = Number(
  flags.find((f) => f.startsWith("--min="))?.slice(6) ?? "1",
);
const requiredSpecs = flags
  .filter((f) => f.startsWith("--require="))
  .map((f) => f.slice(10));

let report;
try {
  report = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error(
    `::error::Could not read Playwright JSON report ${file}: ${error.message}`,
  );
  process.exit(1);
}

const allowedSkips = flags
  .filter((f) => f.startsWith("--allow-skip="))
  .map((f) => f.slice(13));
const maxRetried = Number(
  flags.find((f) => f.startsWith("--max-retried="))?.slice(14) ?? "Infinity",
);
const summary = summarizeReport(report);
for (const [spec, counts] of Object.entries(summary.files).sort()) {
  console.log(`[e2e results] ${spec}: ${JSON.stringify(counts)}`);
}
console.log(
  `[e2e results] total: executed=${summary.executed} skipped=${summary.skipped} failed=${summary.failed}`,
);

console.log(JSON.stringify(summary, null, 2));
const problems = findCoverageProblems(summary, {
  requiredSpecs,
  minExecuted,
  allowedSkips,
  maxRetried,
});
for (const problem of problems) console.error(`::error::${problem}`);
process.exit(problems.length > 0 ? 1 : 0);
