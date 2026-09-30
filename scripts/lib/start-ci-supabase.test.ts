// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

function runStartup(overrides: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "favalog-ci-start-"));
  const commands = join(directory, "commands");
  const summary = join(directory, "summary");
  const stubs = {
    sudo: 'exec "$@"',
    sysctl: `printf 'sysctl:%s\\n' "$*" >> "$COMMANDS"
if [[ "$1" == "-n" ]]; then
  printf '%s\\n' "$RESERVED_PORTS"
else
  exit "$RESERVATION_EXIT"
fi`,
    ss: `printf 'ss:%s\\n' "$*" >> "$COMMANDS"
exit "$DIAGNOSTIC_EXIT"`,
    lsof: `printf 'lsof:%s\\n' "$*" >> "$COMMANDS"
exit "$DIAGNOSTIC_EXIT"`,
    docker: `printf 'docker:%s\\n' "$*" >> "$COMMANDS"
exit "$DIAGNOSTIC_EXIT"`,
    npx: `printf 'npx:%s\\n' "$*" >> "$COMMANDS"
exit "$START_EXIT"`,
  };

  try {
    writeFileSync(commands, "");
    writeFileSync(summary, "");
    for (const [name, body] of Object.entries(stubs)) {
      writeFileSync(join(directory, name), `#!/usr/bin/env bash\n${body}\n`, {
        mode: 0o755,
      });
    }
    const result = spawnSync(
      "bash",
      [resolve("scripts/start-ci-supabase.sh")],
      {
        encoding: "utf8",
        timeout: 5000,
        env: {
          PATH: `${directory}:/usr/bin:/bin`,
          NODE_ENV: "test",
          GITHUB_ACTIONS: "true",
          GITHUB_STEP_SUMMARY: summary,
          COMMANDS: commands,
          RESERVED_PORTS: "",
          RESERVATION_EXIT: "0",
          DIAGNOSTIC_EXIT: "0",
          START_EXIT: "0",
          ...overrides,
        },
      },
    );
    if (result.error) throw result.error;
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      commands: readFileSync(commands, "utf8").trim().split("\n"),
      summary: readFileSync(summary, "utf8"),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("CI local Supabase startup", () => {
  it.each(["", "20000,30000-30005"])(
    "reserves stack ports before pulls while preserving reservations %s",
    (reserved) => {
      const result = runStartup({ RESERVED_PORTS: reserved });
      expect(result.status).toBe(0);
      expect(result.commands.slice(0, 2)).toEqual([
        "sysctl:-n net.ipv4.ip_local_reserved_ports",
        `sysctl:-w net.ipv4.ip_local_reserved_ports=${reserved ? `${reserved},` : ""}54320-54329`,
      ]);
      expect(result.commands.at(-1)).toBe("npx:supabase start");
      expect(result.summary).toBe("");
    },
  );

  it("does not modify kernel settings outside GitHub Actions", () => {
    const result = runStartup({ GITHUB_ACTIONS: "" });
    expect(result.status).toBe(0);
    expect(result.commands.some((line) => line.startsWith("sysctl:"))).toBe(
      false,
    );
    expect(result.commands.at(-1)).toBe("npx:supabase start");
  });

  it("fails before pulling images if reservation cannot be applied", () => {
    const result = runStartup({ RESERVATION_EXIT: "23" });
    expect(result.status).toBe(23);
    expect(result.commands.some((line) => line.startsWith("npx:"))).toBe(false);
    expect(result.output).toContain("tests not executed");
    expect(result.summary).toContain("tests not executed");
  });

  it("preserves a startup failure without retrying or terminating a listener", () => {
    const result = runStartup({ START_EXIT: "17" });
    expect(result.status).toBe(17);
    expect(result.commands.filter((line) => line.startsWith("npx:"))).toEqual([
      "npx:supabase start",
    ]);
    expect(
      result.commands.filter((line) => line.startsWith("docker:")),
    ).toEqual(
      Array(2).fill(
        "docker:ps -a --format {{.Names}}\\t{{.Status}}\\t{{.Ports}}",
      ),
    );
    expect(result.commands).toContain(
      "ss:-tanp ( sport = :54324 or dport = :54324 )",
    );
    expect(result.summary).toContain(
      "No automatic retry or listener termination",
    );
  });

  it("does not mask successful startup when optional diagnostics fail", () => {
    const result = runStartup({ DIAGNOSTIC_EXIT: "1" });
    expect(result.status).toBe(0);
    expect(result.commands.at(-1)).toBe("npx:supabase start");
    expect(result.summary).toBe("");
  });
});
