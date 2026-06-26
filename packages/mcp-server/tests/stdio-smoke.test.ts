import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
  "record_event",
  "assess_delegation_need",
  "generate_delegation_briefs",
  "assess_brief_quality",
  "summarize_subagent_results"
];

let transport: StdioClientTransport | null = null;
let client: Client | null = null;

function parseToolText(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const text = result.content.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("Expected text content from MCP tool result");
  }
  return JSON.parse(text);
}

function appendChildStderr(error: unknown, stderr: string): never {
  const stderrText = stderr.trim();
  if (!stderrText) {
    throw error;
  }

  if (error instanceof Error) {
    error.message = `${error.message}\n\nChild stderr:\n${stderrText}`;
    throw error;
  }

  throw new Error(`MCP stdio smoke failed\n\nChild stderr:\n${stderrText}`, {
    cause: error
  });
}

afterEach(async () => {
  await client?.close();
  client = null;
  transport = null;
});

describe("agent-delegate stdio MCP smoke", () => {
  it("lists and calls all v1 tools through stdio", async () => {
    transport = new StdioClientTransport({
      command: "npm",
      args: ["run", "agent-delegate", "--", "serve"],
      cwd: process.cwd(),
      stderr: "pipe"
    });
    let childStderr = "";
    transport.stderr?.on("data", (chunk: unknown) => {
      childStderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    });

    try {
      client = new Client({ name: "agent-delegate-smoke-test", version: "0.1.0" });
      await client.connect(transport);

      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      expect(names).toEqual([...EXPECTED_TOOLS].sort());

      const recordResult = await client.callTool({
        name: "record_event",
        arguments: {
          event: {
            type: "task_started",
            summary: "Fix slow auth tests"
          }
        }
      });
      const recorded = parseToolText(recordResult) as { ok: boolean; session_id: string };
      expect(recorded.ok).toBe(true);
      expect(recorded.session_id).toMatch(/^session-/);

      await client.callTool({
        name: "record_event",
        arguments: {
          session_id: recorded.session_id,
          event: {
            type: "file_read",
            path: "src/auth/session.ts",
            summary: "Session refresh logic",
            tokens_estimate: 1200
          }
        }
      });

      const assessmentResult = await client.callTool({
        name: "assess_delegation_need",
        arguments: {
          task: "Fix slow auth tests after session refactor",
          current_phase: "investigation",
          context_summary: "Inspected auth runtime, fixtures, and tests. No implementation has started.",
          files_read: [
            { path: "src/auth/session.ts", module: "auth" },
            { path: "src/auth/middleware.ts", module: "auth" },
            { path: "src/auth/token.ts", module: "auth" },
            { path: "tests/auth/session.test.ts", module: "tests" },
            { path: "tests/auth/fixtures.ts", module: "tests" },
            { path: "tests/helpers/time.ts", module: "tests" },
            { path: "src/config/auth.ts", module: "config" },
            { path: "src/http/cookies.ts", module: "http" }
          ],
          open_questions: [
            "Is runtime session refresh causing delay?",
            "Are fixtures creating expired sessions?"
          ],
          metrics: {
            turns_without_write: 4,
            investigation_minutes: 14,
            tool_output_tokens_estimate: 9000
          }
        }
      });
      const assessment = parseToolText(assessmentResult) as { recommendation: string };
      expect(assessment.recommendation).toBe("dispatch_readonly");

      const briefsResult = await client.callTool({
        name: "generate_delegation_briefs",
        arguments: {
          task: "Fix slow auth tests after session refactor",
          current_phase: "investigation",
          context_summary: "Inspected auth runtime, fixtures, and tests. No implementation has started.",
          files_read: [
            { path: "src/auth/session.ts", module: "auth" },
            { path: "tests/auth/fixtures.ts", module: "tests" }
          ],
          open_questions: [
            "Is runtime session refresh causing delay?",
            "Are fixtures creating expired sessions?"
          ],
          max_briefs: 2
        }
      });
      const briefsPayload = parseToolText(briefsResult) as { briefs: Array<Record<string, unknown>> };
      expect(briefsPayload.briefs).toHaveLength(2);

      const qualityResult = await client.callTool({
        name: "assess_brief_quality",
        arguments: {
          brief: briefsPayload.briefs[0]
        }
      });
      const quality = parseToolText(qualityResult) as { quality: string };
      expect(quality.quality).toBe("pass");

      const summaryResult = await client.callTool({
        name: "summarize_subagent_results",
        arguments: {
          task: "Fix slow auth tests after session refactor",
          results: [
            {
              brief_title: "Investigate fixture setup",
              status: "done",
              summary: "Fixtures create expired sessions before the assertion path runs.",
              evidence: ["tests/auth/fixtures.ts:18"],
              recommended_next_steps: ["Inspect fixture expiry setup in the main agent."]
            }
          ],
          target_tokens: 800
        }
      });
      const summary = parseToolText(summaryResult) as { summary: string; confidence: string };
      expect(summary.summary).toContain("Fixtures create expired sessions");
      expect(summary.confidence).toBe("high");
    } catch (error) {
      appendChildStderr(error, childStderr);
    }
  }, 15000);
});
