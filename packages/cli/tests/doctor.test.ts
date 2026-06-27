import { describe, expect, it } from "vitest";
import { doctorCommand, formatDoctorReport } from "../src/commands/doctor";

function captureStdout() {
  let stdout = "";

  return {
    io: {
      stdout: {
        write(chunk: string) {
          stdout += chunk;
        }
      }
    },
    stdout: () => stdout
  };
}

describe("formatDoctorReport", () => {
  it("prints MCP visibility checks and a copyable configuration", () => {
    const report = formatDoctorReport({
      cwd: "/repo/agent-delegate",
      dependencies_installed: true,
      server: {
        ok: true,
        command: "npm run --silent agent-delegate -- serve",
        tools: [
          "assess_brief_quality",
          "assess_delegation_need",
          "generate_delegation_briefs",
          "record_event",
          "summarize_subagent_results"
        ]
      }
    });

    expect(report).toContain("agent-delegate doctor");
    expect(report).toContain("Dependencies: ok");
    expect(report).toContain("MCP server: ok");
    expect(report).toContain("assess_delegation_need");
    expect(report).toContain("\"agent-delegate\"");
    expect(report).toContain("\"cwd\": \"/repo/agent-delegate\"");
  });
});

describe("doctorCommand", () => {
  it("returns success when dependencies and all expected MCP tools are visible", async () => {
    const captured = captureStdout();

    await expect(
      doctorCommand(captured.io, {
        runChecks: async () => ({
          cwd: "/repo/agent-delegate",
          dependencies_installed: true,
          server: {
            ok: true,
            command: "npm run --silent agent-delegate -- serve",
            tools: [
              "record_event",
              "assess_delegation_need",
              "generate_delegation_briefs",
              "assess_brief_quality",
              "summarize_subagent_results"
            ]
          }
        })
      })
    ).resolves.toBe(0);
    expect(captured.stdout()).toContain("Overall: ok");
  });

  it("returns failure when an expected MCP tool is missing", async () => {
    const captured = captureStdout();

    await expect(
      doctorCommand(captured.io, {
        runChecks: async () => ({
          cwd: "/repo/agent-delegate",
          dependencies_installed: true,
          server: {
            ok: true,
            command: "npm run --silent agent-delegate -- serve",
            tools: ["assess_delegation_need"]
          }
        })
      })
    ).resolves.toBe(1);
    expect(captured.stdout()).toContain("Overall: needs attention");
    expect(captured.stdout()).toContain("Missing tools:");
  });
});
