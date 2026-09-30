// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const explore = workflow
  .split("  explore-integration:\n")[1]
  .split("\n  social-integration:")[0];

function step(name: string) {
  const body = explore.split(`      - name: ${name}\n`)[1];
  if (!body) throw new Error(`Missing Explore CI step: ${name}`);
  return body.split("\n      - ")[0];
}

function condition(name: string) {
  return step(name).match(/^        if: (.+)$/m)?.[1];
}

function attempted(id: string) {
  return `\${{ !cancelled() && (steps.${id}.outcome == 'success' || steps.${id}.outcome == 'failure') }}`;
}

describe("Explore CI prerequisite and evidence gates", () => {
  it.each([
    "Run strict Explore Playwright tests",
    "Run slow, partial failure, empty, and disabled discovery scenarios",
    "Reset local database for retry-free first-list repetitions",
    "Reset local database for fixtures suite",
    "Reset local database for production-refusal suite",
  ])("does not run %s after infrastructure or build failure", (name) => {
    expect(condition(name)).toBe(
      "${{ !cancelled() && steps.explore_ready.outcome == 'success' }}",
    );
    const readiness = step("Install Playwright browsers");
    expect(readiness).toContain("id: explore_ready");
    expect(readiness).not.toMatch(/^        if:/m);
    expect(readiness).not.toContain("continue-on-error");
  });

  it.each([
    ["Repeat first-list journey twenty times (no retries)", "first_list_reset"],
    ["Run fixtures Playwright tests", "fixtures_reset"],
    ["Run production-refusal Playwright tests", "prodreject_reset"],
  ])("requires a successful reset for %s", (name, reset) => {
    expect(condition(name)).toBe(
      `\${{ !cancelled() && steps.${reset}.outcome == 'success' }}`,
    );
  });

  it.each([
    ["Upload deterministic retrieval evaluation report", "retrieval_eval"],
    ["Assert strict Explore suite executed", "configured_tests"],
    ["Upload Playwright report", "configured_tests"],
    ["Upload discovery scenario reports", "layout_tests"],
    [
      "Assert all first-list repetitions executed on first attempt",
      "first_list_tests",
    ],
    ["Upload first-list failure traces and report", "first_list_tests"],
    ["Assert fixtures suite executed", "fixtures_tests"],
    [
      "Assert required configured quality and screenshot artifacts",
      "fixtures_tests",
    ],
    ["Upload fixtures Playwright report", "fixtures_tests"],
    ["Upload portfolio screenshots", "fixtures_tests"],
    ["Assert production-refusal suite executed", "prodreject_tests"],
    ["Upload production-refusal Playwright report", "prodreject_tests"],
  ])(
    "checks evidence for %s after success OR failure, never skipped setup",
    (name, producer) => {
      expect(condition(name)).toBe(attempted(producer));
      expect(explore).toContain(`        id: ${producer}\n`);
    },
  );

  it("retains retry-free counts, mandatory artifacts and unconditional cleanup", () => {
    expect(
      step("Repeat first-list journey twenty times (no retries)"),
    ).toContain("--repeat-each=20 --retries=0");
    expect(
      step("Assert all first-list repetitions executed on first attempt"),
    ).toContain("--min=20");
    expect(
      step("Assert all first-list repetitions executed on first attempt"),
    ).toContain("--max-retried=0");
    for (const name of [
      "Upload deterministic retrieval evaluation report",
      "Upload discovery scenario reports",
      "Upload first-list failure traces and report",
      "Upload configured-fixture quality evidence",
      "Upload portfolio screenshots",
    ]) {
      expect(step(name)).toContain("if-no-files-found: error");
    }
    expect(condition("Stop local Supabase stack")).toBe("${{ always() }}");
    expect(explore).not.toContain("continue-on-error");
  });
});
