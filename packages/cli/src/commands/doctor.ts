import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const EXPECTED_MCP_TOOLS = [
  "record_event",
  "assess_delegation_need",
  "generate_delegation_briefs",
  "assess_brief_quality",
  "summarize_subagent_results"
];

const SERVER_COMMAND = "npm run --silent agent-delegate -- serve";
const SERVER_ARGS = ["run", "--silent", "agent-delegate", "--", "serve"];

type Writable = {
  write(chunk: string): unknown;
};

export type DoctorReport = {
  cwd: string;
  dependencies_installed: boolean;
  server: {
    ok: boolean;
    command: string;
    tools: string[];
    error?: string;
  };
};

type DoctorOptions = {
  cwd?: string;
  runChecks?: () => Promise<DoctorReport>;
};

export function missingExpectedTools(tools: string[]): string[] {
  const toolSet = new Set(tools);
  return EXPECTED_MCP_TOOLS.filter((tool) => !toolSet.has(tool));
}

export function doctorReportIsOk(report: DoctorReport): boolean {
  return (
    report.dependencies_installed &&
    report.server.ok &&
    missingExpectedTools(report.server.tools).length === 0
  );
}

export function formatDoctorReport(report: DoctorReport): string {
  const missingTools = missingExpectedTools(report.server.tools);
  const config = {
    mcpServers: {
      "agent-delegate": {
        command: "npm",
        args: SERVER_ARGS,
        cwd: report.cwd
      }
    }
  };
  const lines = [
    "agent-delegate doctor",
    "",
    `Working directory: ${report.cwd}`,
    `Dependencies: ${report.dependencies_installed ? "ok" : "missing node_modules (run npm install)"}`,
    `MCP server: ${report.server.ok ? "ok" : "failed"}`,
    `Server command: ${report.server.command}`
  ];

  if (report.server.tools.length > 0) {
    lines.push(`Found tools: ${[...report.server.tools].sort().join(", ")}`);
  }

  if (missingTools.length > 0) {
    lines.push(`Missing tools: ${missingTools.join(", ")}`);
  }

  if (report.server.error) {
    lines.push(`Server error: ${report.server.error}`);
  }

  lines.push(
    "",
    "Generic MCP configuration:",
    JSON.stringify(config, null, 2),
    "",
    `Overall: ${doctorReportIsOk(report) ? "ok" : "needs attention"}`
  );

  return `${lines.join("\n")}\n`;
}

export async function runDoctorChecks(cwd = process.cwd()): Promise<DoctorReport> {
  const dependenciesInstalled = existsSync(join(cwd, "node_modules"));
  const transport = new StdioClientTransport({
    command: "npm",
    args: SERVER_ARGS,
    cwd,
    stderr: "pipe"
  });
  let childStderr = "";
  transport.stderr?.on("data", (chunk: unknown) => {
    childStderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  });

  const client = new Client({ name: "agent-delegate-doctor", version: "0.1.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    return {
      cwd,
      dependencies_installed: dependenciesInstalled,
      server: {
        ok: true,
        command: SERVER_COMMAND,
        tools: tools.tools.map((tool) => tool.name)
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = childStderr.trim();
    return {
      cwd,
      dependencies_installed: dependenciesInstalled,
      server: {
        ok: false,
        command: SERVER_COMMAND,
        tools: [],
        error: stderr ? `${message}\nChild stderr:\n${stderr}` : message
      }
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function doctorCommand(
  io: { stdout: Writable } = { stdout: process.stdout },
  options: DoctorOptions = {}
): Promise<number> {
  const report = await (options.runChecks ?? (() => runDoctorChecks(options.cwd)))();
  io.stdout.write(formatDoctorReport(report));
  return doctorReportIsOk(report) ? 0 : 1;
}
