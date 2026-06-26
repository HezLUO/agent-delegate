# agent-delegate Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `agent-delegate` dogfoodable in one real MCP-enabled agent workflow before any open-source release work.

**Architecture:** Add a real stdio MCP client smoke path that launches the local `agent-delegate` server and calls all five tools, add dogfood fixtures that model realistic agent states, and document a manual dogfood protocol. Keep this phase focused on validation and documentation; do not add v2 write-agent features.

**Tech Stack:** TypeScript, npm workspaces, Vitest, tsx, Node.js, `@modelcontextprotocol/sdk` v1.

---

## File Structure

Create or modify these files:

```text
package.json
README.md
docs/
  dogfood.md
examples/
  dogfood-long-investigation.json
  dogfood-small-edit.json
  dogfood-ambiguous-goal.json
scripts/
  mcp-smoke.ts
packages/
  mcp-server/
    tests/
      stdio-smoke.test.ts
```

Responsibilities:

- `scripts/mcp-smoke.ts`: launches the MCP server over stdio with the official MCP client and calls all five v1 tools.
- `packages/mcp-server/tests/stdio-smoke.test.ts`: automated regression test for the real stdio MCP server path.
- `examples/dogfood-*.json`: realistic `AgentState` fixtures for dogfood sessions.
- `docs/dogfood.md`: manual protocol for trying the product in a real agent workflow before publishing.
- `README.md`: points users to the dogfood flow and clearly states that release readiness requires real MCP trial.

## Task 1: Add Real MCP Stdio Smoke Test

**Files:**
- Create: `packages/mcp-server/tests/stdio-smoke.test.ts`

- [ ] **Step 1: Write the failing stdio smoke test**

Create `packages/mcp-server/tests/stdio-smoke.test.ts`:

```ts
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
  }, 15000);
});
```

- [ ] **Step 2: Run the smoke test**

Run:

```bash
npm test -- packages/mcp-server/tests/stdio-smoke.test.ts
```

Expected: PASS with the stdio client listing and calling all five tools.

- [ ] **Step 3: Commit the stdio smoke test**

Run:

```bash
git add packages/mcp-server/tests/stdio-smoke.test.ts
git commit -m "test: add MCP stdio smoke coverage"
```

## Task 2: Add Manual MCP Smoke Script

**Files:**
- Create: `scripts/mcp-smoke.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the manual smoke script**

Create `scripts/mcp-smoke.ts`:

```ts
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

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "npm",
    args: ["run", "agent-delegate", "--", "serve"],
    cwd: process.cwd(),
    stderr: "pipe"
  });
  const client = new Client({ name: "agent-delegate-smoke", version: "0.1.0" });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    const missing = EXPECTED_TOOLS.filter((tool) => !names.includes(tool));
    if (missing.length > 0) {
      throw new Error(`Missing MCP tools: ${missing.join(", ")}`);
    }
    console.log(`Listed ${names.length} MCP tools: ${names.join(", ")}`);

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
    console.log("MCP smoke passed");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Add a dedicated MCP smoke script entry**

Modify the root `package.json` `scripts` block to include `smoke:mcp` while preserving existing scripts:

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "typecheck": "tsc -b packages/core packages/mcp-server packages/cli",
    "agent-delegate": "tsx packages/cli/src/index.ts",
    "smoke:mcp": "tsx scripts/mcp-smoke.ts"
  }
}
```

- [ ] **Step 3: Run the manual smoke script**

Run:

```bash
npm run smoke:mcp
```

Expected output includes:

```text
Listed 5 MCP tools
Assessment passed: dispatch_readonly
Brief generation passed: 2 briefs
Brief quality passed
Summary passed
MCP smoke passed
```

- [ ] **Step 4: Commit the manual smoke script**

Run:

```bash
git add package.json scripts/mcp-smoke.ts
git commit -m "test: add manual MCP smoke script"
```

## Task 3: Add Dogfood Fixtures

**Files:**
- Create: `examples/dogfood-long-investigation.json`
- Create: `examples/dogfood-small-edit.json`
- Create: `examples/dogfood-ambiguous-goal.json`

- [ ] **Step 1: Add long-investigation fixture**

Create `examples/dogfood-long-investigation.json`:

```json
{
  "task": "Fix slow auth tests after session refactor",
  "current_phase": "investigation",
  "context_summary": "The main agent has inspected auth runtime, middleware, test fixtures, and helper utilities. No implementation has started, and there are two separable questions.",
  "files_read": [
    { "path": "src/auth/session.ts", "module": "auth", "summary": "Session validation and refresh logic", "tokens_estimate": 1200 },
    { "path": "src/auth/middleware.ts", "module": "auth", "summary": "Auth middleware request path", "tokens_estimate": 900 },
    { "path": "src/auth/token.ts", "module": "auth", "summary": "Token parsing and expiry checks", "tokens_estimate": 700 },
    { "path": "tests/auth/session.test.ts", "module": "tests", "summary": "Slow auth test cases", "tokens_estimate": 1000 },
    { "path": "tests/auth/fixtures.ts", "module": "tests", "summary": "Auth fixture setup", "tokens_estimate": 800 },
    { "path": "tests/helpers/time.ts", "module": "tests", "summary": "Time helper behavior", "tokens_estimate": 500 },
    { "path": "src/config/auth.ts", "module": "config", "summary": "Auth config defaults", "tokens_estimate": 400 },
    { "path": "src/http/cookies.ts", "module": "http", "summary": "Cookie serialization", "tokens_estimate": 600 }
  ],
  "open_questions": [
    "Is runtime session refresh causing delay?",
    "Are fixtures creating expired sessions?"
  ],
  "metrics": {
    "turns_without_write": 4,
    "investigation_minutes": 14,
    "tool_output_tokens_estimate": 9000
  }
}
```

- [ ] **Step 2: Add small-edit fixture**

Create `examples/dogfood-small-edit.json`:

```json
{
  "task": "Fix typo in auth error message",
  "current_phase": "investigation",
  "context_summary": "The typo is isolated to one file and the next edit is obvious.",
  "files_read": [
    { "path": "src/auth/errors.ts", "module": "auth", "summary": "Auth error message constants", "tokens_estimate": 300 }
  ],
  "findings": [
    { "summary": "One obvious edit is needed in the error message constant.", "evidence": ["src/auth/errors.ts"] }
  ],
  "open_questions": [],
  "metrics": {
    "turns_without_write": 1,
    "tool_output_tokens_estimate": 500
  }
}
```

- [ ] **Step 3: Add ambiguous-goal fixture**

Create `examples/dogfood-ambiguous-goal.json`:

```json
{
  "task": "Make it better",
  "current_phase": "planning",
  "context_summary": "",
  "files_read": [],
  "open_questions": [],
  "metrics": {
    "turns_without_write": 0,
    "tool_output_tokens_estimate": 0
  }
}
```

- [ ] **Step 4: Run fixtures through CLI**

Run:

```bash
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Expected:

```text
dogfood-long-investigation.json -> "recommendation": "dispatch_readonly"
dogfood-small-edit.json -> "recommendation": "continue_main_agent"
dogfood-ambiguous-goal.json -> "recommendation": "ask_human"
```

- [ ] **Step 5: Commit dogfood fixtures**

Run:

```bash
git add examples/dogfood-long-investigation.json examples/dogfood-small-edit.json examples/dogfood-ambiguous-goal.json
git commit -m "test: add dogfood agent state fixtures"
```

## Task 4: Document Manual Dogfood Protocol

**Files:**
- Create: `docs/dogfood.md`
- Modify: `README.md`

- [ ] **Step 1: Write dogfood protocol**

Create `docs/dogfood.md`:

```md
# Dogfood Protocol

Do not treat `agent-delegate` as release-ready until it has been used through a real MCP workflow.

## Goal

Verify that a real agent or MCP client can call `agent-delegate`, receive useful delegation advice, generate readable read-only briefs, and summarize subagent results without relying only on unit tests.

## Required Checks

Run these commands before considering an open-source release:

```bash
npm test
npm run typecheck
npm run build
npm run smoke:mcp
```

Then run the dogfood fixtures:

```bash
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Expected recommendations:

| Fixture | Expected recommendation |
| --- | --- |
| `examples/dogfood-long-investigation.json` | `dispatch_readonly` |
| `examples/dogfood-small-edit.json` | `continue_main_agent` |
| `examples/dogfood-ambiguous-goal.json` | `ask_human` |

## Real Agent Trial

Configure the MCP server in one agent tool, then start a real coding task that requires investigation.

The agent should call:

1. `assess_delegation_need` after investigation grows beyond a small local edit.
2. `generate_delegation_briefs` if the recommendation is `dispatch_readonly`.
3. `assess_brief_quality` before dispatching a brief.
4. `summarize_subagent_results` after read-only subagents return.

## Pass Criteria

The trial passes only if:

- The agent can list all five MCP tools.
- The agent can call all five MCP tools without schema confusion.
- `dispatch_readonly` appears for a genuinely broad investigation.
- `continue_main_agent` appears for a small local edit.
- Generated briefs are specific enough to hand to a read-only subagent.
- Result summaries are short enough to paste back into the main agent context.

## Fail Criteria

The trial fails if:

- The MCP server cannot be launched by the agent.
- Tool schemas are too hard for the agent to satisfy.
- The agent over-calls the tool for tiny tasks.
- Generated briefs are broad or imply write access.
- The result summary loses important uncertainty or evidence.

Fix failures before publishing the project publicly.
```

- [ ] **Step 2: Add dogfood section to README**

Add this section to `README.md` after the "Analyze a Sample Agent State" section:

```md
## Dogfood Before Release

This project should be dogfooded before any open-source release. Unit tests are not enough because the core product is an MCP tool used by real agents.

Run the MCP smoke test:

```bash
npm run smoke:mcp
```

Run realistic fixtures:

```bash
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

See [docs/dogfood.md](docs/dogfood.md) for the full dogfood protocol.
```

- [ ] **Step 3: Verify README link and commands**

Run:

```bash
test -f docs/dogfood.md
test -f examples/dogfood-long-investigation.json
npm run smoke:mcp
```

Expected: both `test -f` commands exit successfully and `npm run smoke:mcp` prints `MCP smoke passed`.

- [ ] **Step 4: Commit dogfood docs**

Run:

```bash
git add README.md docs/dogfood.md
git commit -m "docs: add dogfood protocol"
```

## Task 5: Final Dogfood Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run MCP smoke**

Run:

```bash
npm run smoke:mcp
```

Expected output includes:

```text
MCP smoke passed
```

- [ ] **Step 5: Run dogfood fixture checks**

Run:

```bash
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Expected:

```text
dogfood-long-investigation.json -> dispatch_readonly
dogfood-small-edit.json -> continue_main_agent
dogfood-ambiguous-goal.json -> ask_human
```

- [ ] **Step 6: Inspect git history**

Run:

```bash
git log --oneline -5
git status --short
```

Expected: recent commits include dogfood work, and `git status --short` is empty.

## Execution Notes

This plan does not publish the project, add a license, create a GitHub repository, add CI, or add write-agent delegation. Those belong after dogfooding shows the MCP workflow is usable.

The stdio smoke commands spawn `npm run agent-delegate -- serve`. In restricted Codex environments, this can require elevated execution because `tsx` and stdio child processes may need IPC pipe permissions. If a sandboxed smoke run fails with `EPERM`, rerun the same command with the required sandbox escalation and record that behavior in the final report.
