import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
  "record_event",
  "assess_delegation_need",
  "generate_delegation_briefs",
  "assess_brief_quality",
  "summarize_subagent_results"
];

type ToolTextResult = {
  content: Array<{ type: string; text?: string }>;
};

function parseToolText<T>(result: ToolTextResult): T {
  const text = result.content.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("Expected MCP tool result to include text content");
  }
  return JSON.parse(text) as T;
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

  throw new Error(`MCP smoke failed\n\nChild stderr:\n${stderrText}`, {
    cause: error
  });
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "npm",
    args: ["run", "--silent", "agent-delegate", "--", "serve"],
    cwd: process.cwd(),
    stderr: "pipe"
  });
  let childStderr = "";
  transport.stderr?.on("data", (chunk: unknown) => {
    childStderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  });

  const client = new Client({ name: "agent-delegate-smoke", version: "0.1.0" });
  const clientErrors: Error[] = [];
  client.onerror = (error) => {
    clientErrors.push(error);
  };

  function assertNoClientErrors(): void {
    if (clientErrors.length > 0) {
      throw new Error(
        `Unexpected MCP client error(s): ${clientErrors.map((error) => error.message).join("; ")}`
      );
    }
  }

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assertNoClientErrors();
    const names = tools.tools.map((tool) => tool.name).sort();
    const expectedNames = [...EXPECTED_TOOLS].sort();
    if (
      names.length !== expectedNames.length ||
      names.some((name, index) => name !== expectedNames[index])
    ) {
      throw new Error(
        `Unexpected MCP tools. Expected: ${expectedNames.join(", ")}. Received: ${names.join(", ")}`
      );
    }
    console.log(`Listed ${names.length} MCP tools: ${names.join(", ")}`);

    const recorded = parseToolText<{ ok: boolean; session_id: string }>(
      await client.callTool({
        name: "record_event",
        arguments: {
          event: {
            type: "task_started",
            timestamp: "2026-06-27T20:47:12+08:00",
            summary: "Fix slow auth tests"
          }
        }
      }) as ToolTextResult
    );
    if (!recorded.ok) {
      throw new Error("Expected record_event ok to be true");
    }
    if (!/^session-/.test(recorded.session_id)) {
      throw new Error(`Expected record_event session_id to start with session-, got ${recorded.session_id}`);
    }
    console.log("Record event passed");

    const assessment = parseToolText<{ recommendation: string; confidence: string }>(
      await client.callTool({
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
      }) as ToolTextResult
    );

    if (assessment.recommendation !== "dispatch_readonly") {
      throw new Error(`Expected dispatch_readonly, got ${assessment.recommendation}`);
    }
    console.log(`Assessment passed: ${assessment.recommendation} (${assessment.confidence})`);

    const briefs = parseToolText<{ briefs: Array<Record<string, unknown>> }>(
      await client.callTool({
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
      }) as ToolTextResult
    );
    if (briefs.briefs.length !== 2) {
      throw new Error(`Expected 2 briefs, got ${briefs.briefs.length}`);
    }
    console.log(`Brief generation passed: ${briefs.briefs.length} briefs`);

    const quality = parseToolText<{ quality: string }>(
      await client.callTool({
        name: "assess_brief_quality",
        arguments: { brief: briefs.briefs[0] }
      }) as ToolTextResult
    );
    if (quality.quality !== "pass") {
      throw new Error(`Expected brief quality pass, got ${quality.quality}`);
    }
    console.log("Brief quality passed");

    const summary = parseToolText<{ confidence: string; summary: string }>(
      await client.callTool({
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
      }) as ToolTextResult
    );
    if (summary.confidence !== "high") {
      throw new Error(`Expected summary confidence high, got ${summary.confidence}`);
    }
    console.log("Summary passed");
    assertNoClientErrors();
    console.log("MCP smoke passed");
  } catch (error) {
    appendChildStderr(error, childStderr);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
