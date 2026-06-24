# agent-delegate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 `agent-delegate` MCP-first read-only delegation advisor described in `docs/superpowers/specs/2026-06-24-agent-delegate-design.md`.

**Architecture:** Use a TypeScript npm workspace with a dependency-free core package, an MCP server package that wraps core functions as tools, a CLI package for `serve`, `analyze`, and `init`, and a rules package with text templates. Core owns all schemas, policy scoring, brief generation, brief quality checks, session event storage, and result summarization.

**Tech Stack:** TypeScript, npm workspaces, Zod, Vitest, tsx, Node.js, `@modelcontextprotocol/sdk` v1.

---

## File Structure

Create this repository structure:

```text
package.json
tsconfig.base.json
vitest.config.ts
README.md
examples/
  agent-state.sample.json
  subagent-result.sample.json
packages/
  core/
    package.json
    tsconfig.json
    src/
      index.ts
      schema.ts
      policy.ts
      briefs.ts
      summary.ts
      events.ts
      redaction.ts
    tests/
      schema.test.ts
      policy.test.ts
      briefs.test.ts
      summary.test.ts
      events.test.ts
  mcp-server/
    package.json
    tsconfig.json
    src/
      index.ts
      server.ts
  cli/
    package.json
    tsconfig.json
    src/
      index.ts
      commands/
        analyze.ts
        init.ts
        serve.ts
    tests/
      analyze.test.ts
      init.test.ts
  rules/
    codex/AGENTS.fragment.md
    claude-code/CLAUDE.fragment.md
    generic/agent-delegate-rules.md
```

Responsibilities:

- `packages/core`: Zod schemas, type exports, policy scoring, brief generation, brief checking, result summarization, lightweight event sessions, and secret-like content rejection.
- `packages/mcp-server`: MCP server factory and stdio entrypoint.
- `packages/cli`: local commands for serving MCP, analyzing JSON, and printing rules.
- `packages/rules`: static rules snippets copied by `agent-delegate init`.

## Task 1: Scaffold TypeScript Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Modify: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`

- [ ] **Step 1: Write root package metadata**

Create `package.json`:

```json
{
  "name": "agent-delegate-repo",
  "private": true,
  "version": "0.1.0",
  "description": "MCP-first delegation advisor for coding agents.",
  "workspaces": [
    "packages/core",
    "packages/mcp-server",
    "packages/cli"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "typecheck": "tsc -b packages/core packages/mcp-server packages/cli",
    "agent-delegate": "tsx packages/cli/src/index.ts"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.25.0"
  }
}
```

- [ ] **Step 2: Write TypeScript base config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Write Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node"
  }
});
```

- [ ] **Step 4: Expand `.gitignore`**

Replace `.gitignore` with:

```gitignore
.superpowers/
node_modules/
dist/
coverage/
.DS_Store
```

- [ ] **Step 5: Write package configs**

Create `packages/core/package.json`:

```json
{
  "name": "@agent-delegate/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "zod": "^3.25.0"
  }
}
```

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"]
}
```

Create `packages/mcp-server/package.json`:

```json
{
  "name": "@agent-delegate/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "agent-delegate-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@agent-delegate/core": "0.1.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.25.0"
  }
}
```

Create `packages/mcp-server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "references": [{ "path": "../core" }],
  "include": ["src"]
}
```

Create `packages/cli/package.json`:

```json
{
  "name": "agent-delegate",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "agent-delegate": "dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@agent-delegate/core": "0.1.0",
    "@agent-delegate/mcp-server": "0.1.0"
  }
}
```

Create `packages/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "references": [{ "path": "../core" }, { "path": "../mcp-server" }],
  "include": ["src"]
}
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 7: Verify empty workspace scripts**

Run:

```bash
npm test
```

Expected: Vitest starts and reports no tests or no test files. If Vitest exits non-zero because no tests exist, proceed to Task 2 and use the first real test run as verification.

- [ ] **Step 8: Commit scaffold**

Run:

```bash
git add .gitignore package.json package-lock.json tsconfig.base.json vitest.config.ts packages
git commit -m "chore: scaffold TypeScript workspace"
```

## Task 2: Define Core Schemas

**Files:**
- Create: `packages/core/src/schema.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/tests/schema.test.ts`

- [ ] **Step 1: Write schema tests**

Create `packages/core/tests/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AgentStateSchema,
  DelegationBriefSchema,
  SubagentResultInputSchema
} from "../src/schema";

describe("schema", () => {
  it("accepts a minimal agent state", () => {
    const parsed = AgentStateSchema.parse({
      task: "Fix slow auth tests",
      current_phase: "investigation"
    });

    expect(parsed.task).toBe("Fix slow auth tests");
    expect(parsed.current_phase).toBe("investigation");
  });

  it("rejects write-mode delegation briefs in v1", () => {
    expect(() =>
      DelegationBriefSchema.parse({
        title: "Patch auth tests",
        mode: "write",
        goal: "Change the tests",
        scope: { files: ["tests/auth/session.test.ts"] },
        context: "The tests are slow.",
        questions: ["What should change?"],
        expected_output: ["Patch"],
        budget: { max_files: 2 },
        stop_conditions: ["Stop after editing tests"]
      })
    ).toThrow();
  });

  it("accepts readonly subagent result inputs", () => {
    const parsed = SubagentResultInputSchema.parse({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: "Fixture setup creates expired sessions.",
          evidence: ["tests/auth/fixtures.ts:18"]
        }
      ],
      target_tokens: 800
    });

    expect(parsed.results[0].status).toBe("done");
  });
});
```

- [ ] **Step 2: Run schema tests and verify failure**

Run:

```bash
npm test -- packages/core/tests/schema.test.ts
```

Expected: FAIL because `packages/core/src/schema.ts` does not exist.

- [ ] **Step 3: Implement schemas**

Create `packages/core/src/schema.ts`:

```ts
import { z } from "zod";

export const CurrentPhaseSchema = z.enum([
  "planning",
  "investigation",
  "implementation",
  "debugging",
  "review",
  "verification"
]);

export const RecommendationSchema = z.enum([
  "continue_main_agent",
  "summarize_context",
  "dispatch_readonly",
  "ask_human"
]);

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const FileObservationSchema = z.object({
  path: z.string().min(1),
  summary: z.string().optional(),
  module: z.string().optional(),
  tokens_estimate: z.number().int().nonnegative().optional()
});

export const CommandObservationSchema = z.object({
  command: z.string().min(1),
  summary: z.string().optional(),
  status: z.enum(["passed", "failed", "unknown"]).default("unknown"),
  tokens_estimate: z.number().int().nonnegative().optional()
});

export const FindingSchema = z.object({
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([])
});

export const DelegationConstraintsSchema = z.object({
  max_subagents: z.number().int().positive().max(3).default(3),
  allow_write_agents: z.literal(false).default(false)
});

export const AgentStateSchema = z.object({
  task: z.string().min(1),
  current_phase: CurrentPhaseSchema,
  context_summary: z.string().optional(),
  files_read: z.array(FileObservationSchema).default([]),
  commands_run: z.array(CommandObservationSchema).default([]),
  files_written: z.array(z.string().min(1)).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  findings: z.array(FindingSchema).default([]),
  constraints: DelegationConstraintsSchema.default({
    max_subagents: 3,
    allow_write_agents: false
  }),
  metrics: z
    .object({
      turns_without_write: z.number().int().nonnegative().optional(),
      investigation_minutes: z.number().nonnegative().optional(),
      tool_output_tokens_estimate: z.number().int().nonnegative().optional(),
      same_question_repeated: z.number().int().nonnegative().optional(),
      tests_failures_in_independent_files: z.number().int().nonnegative().optional()
    })
    .default({})
});

export const GuardrailHitSchema = z.object({
  name: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  detail: z.string().min(1)
});

export const DelegationAssessmentSchema = z.object({
  recommendation: RecommendationSchema,
  confidence: ConfidenceSchema,
  scores: z.record(z.number()),
  reasons: z.array(z.string().min(1)),
  guardrails: z.array(GuardrailHitSchema),
  suggested_next_step: z.string().min(1),
  suggested_brief_count: z.number().int().positive().max(3).optional()
});

export const DelegationBriefSchema = z.object({
  title: z.string().min(1),
  mode: z.literal("readonly"),
  goal: z.string().min(1),
  scope: z.object({
    files: z.array(z.string().min(1)).optional(),
    modules: z.array(z.string().min(1)).optional(),
    exclude_files: z.array(z.string().min(1)).optional()
  }),
  context: z.string().min(1),
  questions: z.array(z.string().min(1)).min(1),
  expected_output: z.array(z.string().min(1)).min(1),
  budget: z.object({
    max_files: z.number().int().positive().optional(),
    max_minutes: z.number().positive().optional(),
    max_tokens: z.number().int().positive().optional()
  }),
  stop_conditions: z.array(z.string().min(1)).min(1)
});

export const BriefQualityInputSchema = z.object({
  brief: DelegationBriefSchema
});

export const BriefQualityResultSchema = z.object({
  quality: z.enum(["pass", "needs_revision"]),
  issues: z.array(z.string()),
  improved_brief: DelegationBriefSchema.nullable()
});

export const SubagentResultSchema = z.object({
  brief_title: z.string().min(1),
  status: z.enum(["done", "blocked", "needs_context"]),
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  recommended_next_steps: z.array(z.string().min(1)).default([])
});

export const SubagentResultInputSchema = z.object({
  task: z.string().min(1),
  results: z.array(SubagentResultSchema).min(1),
  target_tokens: z.number().int().positive().default(800)
});

export const SubagentResultSummarySchema = z.object({
  summary: z.string().min(1),
  confirmed_findings: z.array(FindingSchema),
  conflicts_or_disagreements: z.array(z.string()),
  open_questions: z.array(z.string()),
  recommended_next_steps: z.array(z.string()),
  files_to_revisit: z.array(z.string()),
  confidence: ConfidenceSchema
});

export const AgentEventSchema = z.object({
  type: z.enum([
    "task_started",
    "file_read",
    "command_run",
    "test_run",
    "file_written",
    "error_seen",
    "question_identified",
    "plan_created",
    "delegation_decision"
  ]),
  timestamp: z.string().datetime().optional(),
  summary: z.string().optional(),
  path: z.string().optional(),
  command: z.string().optional(),
  status: z.string().optional(),
  tokens_estimate: z.number().int().nonnegative().optional()
});

export const RecordEventInputSchema = z.object({
  session_id: z.string().min(1).optional(),
  event: AgentEventSchema
});

export type AgentState = z.infer<typeof AgentStateSchema>;
export type DelegationAssessment = z.infer<typeof DelegationAssessmentSchema>;
export type DelegationBrief = z.infer<typeof DelegationBriefSchema>;
export type BriefQualityResult = z.infer<typeof BriefQualityResultSchema>;
export type SubagentResultInput = z.infer<typeof SubagentResultInputSchema>;
export type SubagentResultSummary = z.infer<typeof SubagentResultSummarySchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type RecordEventInput = z.infer<typeof RecordEventInputSchema>;
```

Create `packages/core/src/index.ts`:

```ts
export * from "./schema.js";
```

- [ ] **Step 4: Run schema tests**

Run:

```bash
npm test -- packages/core/tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit schemas**

Run:

```bash
git add packages/core/src packages/core/tests
git commit -m "feat: define core schemas"
```

## Task 3: Implement Policy Engine

**Files:**
- Create: `packages/core/src/policy.ts`
- Create: `packages/core/tests/policy.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write policy fixture tests**

Create `packages/core/tests/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assessDelegationNeed } from "../src/policy";

describe("assessDelegationNeed", () => {
  it("continues for a small local task with a clear next edit", () => {
    const assessment = assessDelegationNeed({
      task: "Rename typo in auth error message",
      current_phase: "investigation",
      context_summary: "Found the typo in one file.",
      files_read: [{ path: "src/auth/errors.ts", module: "auth" }],
      findings: [{ summary: "One obvious edit is needed.", evidence: ["src/auth/errors.ts"] }],
      open_questions: [],
      files_written: [],
      metrics: { turns_without_write: 1 }
    });

    expect(assessment.recommendation).toBe("continue_main_agent");
    expect(assessment.confidence).toBe("high");
  });

  it("dispatches readonly when investigation spans many files and questions", () => {
    const assessment = assessDelegationNeed({
      task: "Fix slow auth tests",
      current_phase: "investigation",
      context_summary: "Read auth runtime, middleware, fixtures, and test helpers.",
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
        "Is token refresh timing responsible?",
        "Are fixtures creating expired sessions?"
      ],
      metrics: {
        turns_without_write: 4,
        investigation_minutes: 14,
        tool_output_tokens_estimate: 9000
      }
    });

    expect(assessment.recommendation).toBe("dispatch_readonly");
    expect(assessment.suggested_brief_count).toBe(2);
    expect(assessment.reasons.length).toBeGreaterThan(0);
  });

  it("summarizes context when investigation is large but split is unclear", () => {
    const assessment = assessDelegationNeed({
      task: "Understand why checkout behavior changed",
      current_phase: "investigation",
      context_summary: "Many findings are scattered and no plan exists.",
      files_read: Array.from({ length: 12 }, (_, index) => ({
        path: `src/checkout/file-${index}.ts`,
        module: "checkout"
      })),
      open_questions: ["What changed?"],
      metrics: {
        turns_without_write: 5,
        tool_output_tokens_estimate: 14000
      }
    });

    expect(assessment.recommendation).toBe("summarize_context");
  });

  it("asks the human when the goal is ambiguous", () => {
    const assessment = assessDelegationNeed({
      task: "Make it better",
      current_phase: "planning",
      context_summary: "",
      files_read: [],
      open_questions: []
    });

    expect(assessment.recommendation).toBe("ask_human");
  });
});
```

- [ ] **Step 2: Run policy tests and verify failure**

Run:

```bash
npm test -- packages/core/tests/policy.test.ts
```

Expected: FAIL because `packages/core/src/policy.ts` does not exist.

- [ ] **Step 3: Implement policy engine**

Create `packages/core/src/policy.ts`:

```ts
import {
  AgentState,
  AgentStateSchema,
  DelegationAssessment,
  GuardrailHitSchema
} from "./schema.js";

type ScoreName =
  | "continue_main_agent"
  | "summarize_context"
  | "dispatch_readonly"
  | "ask_human";

const AMBIGUOUS_TASK_PATTERNS = [
  /^make it better$/i,
  /^fix it$/i,
  /^improve this$/i,
  /^clean this up$/i
];

function moduleCount(state: AgentState): number {
  const modules = new Set(
    state.files_read.map((file) => file.module ?? file.path.split("/").slice(0, 2).join("/"))
  );
  return modules.size;
}

function hasClearNextEdit(state: AgentState): boolean {
  return state.findings.some((finding) => /obvious edit|single edit|one .* edit/i.test(finding.summary));
}

function ambiguousGoal(task: string): boolean {
  return AMBIGUOUS_TASK_PATTERNS.some((pattern) => pattern.test(task.trim()));
}

function confidenceFor(best: number, second: number, guardrails: number): "low" | "medium" | "high" {
  if (best - second >= 4 && guardrails === 0) {
    return "high";
  }
  if (best - second >= 2) {
    return "medium";
  }
  return "low";
}

export function assessDelegationNeed(input: unknown): DelegationAssessment {
  const state = AgentStateSchema.parse(input);
  const scores: Record<ScoreName, number> = {
    continue_main_agent: 0,
    summarize_context: 0,
    dispatch_readonly: 0,
    ask_human: 0
  };
  const reasons: string[] = [];
  const guardrails: Array<ReturnType<typeof GuardrailHitSchema.parse>> = [];

  const filesRead = state.files_read.length;
  const modulesTouched = moduleCount(state);
  const openQuestions = state.open_questions.length;
  const turnsWithoutWrite = state.metrics.turns_without_write ?? 0;
  const investigationMinutes = state.metrics.investigation_minutes ?? 0;
  const toolOutputTokens = state.metrics.tool_output_tokens_estimate ?? 0;
  const independentFailures = state.metrics.tests_failures_in_independent_files ?? 0;

  if (ambiguousGoal(state.task)) {
    scores.ask_human += 8;
    reasons.push("The task goal is too ambiguous to delegate safely.");
  }

  if (filesRead <= 3) {
    scores.continue_main_agent += 3;
    reasons.push("The investigation is still small.");
  }

  if (modulesTouched <= 1 && filesRead > 0) {
    scores.continue_main_agent += 2;
    guardrails.push({
      name: "single_module_scope",
      severity: "medium",
      detail: "The likely root cause appears concentrated in one module."
    });
  }

  if (hasClearNextEdit(state)) {
    scores.continue_main_agent += 5;
    reasons.push("There is one obvious next edit.");
  }

  if (state.files_written.length > 0) {
    scores.continue_main_agent += 2;
    reasons.push("Implementation has already started.");
  }

  if (filesRead >= 8) {
    scores.dispatch_readonly += 3;
    reasons.push(`The agent has read ${filesRead} files.`);
  }

  if (turnsWithoutWrite >= 3) {
    scores.dispatch_readonly += 2;
    reasons.push(`There have been ${turnsWithoutWrite} turns without a file write.`);
  }

  if (investigationMinutes >= 10) {
    scores.dispatch_readonly += 2;
    reasons.push(`Investigation has lasted about ${investigationMinutes} minutes.`);
  }

  if (openQuestions >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push("There are multiple open questions that may be separable.");
  }

  if (modulesTouched >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push(`The investigation spans ${modulesTouched} modules.`);
  }

  if (toolOutputTokens >= 6000) {
    scores.dispatch_readonly += 1;
    reasons.push("Tool output is large enough to create context pressure.");
  }

  if (independentFailures >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push("There are failing tests in multiple independent files.");
  }

  if (!state.context_summary || state.context_summary.trim().length < 20) {
    scores.summarize_context += 3;
    reasons.push("The context summary is missing or too thin.");
  }

  if (toolOutputTokens >= 10000) {
    scores.summarize_context += 5;
    reasons.push("Tool output is very large and should be summarized.");
  }

  if (state.findings.length >= 3 && openQuestions === 0) {
    scores.summarize_context += 2;
    reasons.push("There are many findings but no explicit next plan.");
  }

  if (modulesTouched <= 1 && filesRead >= 8) {
    scores.dispatch_readonly -= 4;
    scores.summarize_context += 3;
  }

  if (openQuestions === 0 && filesRead >= 8) {
    scores.dispatch_readonly -= 2;
    scores.summarize_context += 2;
    guardrails.push({
      name: "unclear_delegation_question",
      severity: "medium",
      detail: "The agent has not identified bounded questions for subagents."
    });
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<[ScoreName, number]>;
  const [bestName, bestScore] = ranked[0];
  const secondScore = ranked[1][1];
  const recommendation =
    bestScore <= 0 ? "continue_main_agent" : bestName === "dispatch_readonly" && guardrails.some((g) => g.severity === "high") ? "summarize_context" : bestName;

  const confidence = confidenceFor(bestScore, secondScore, guardrails.length);
  const suggestedBriefCount =
    recommendation === "dispatch_readonly" ? Math.min(3, Math.max(1, openQuestions)) : undefined;

  const suggestedNextStepByRecommendation: Record<ScoreName, string> = {
    continue_main_agent: "Continue in the main agent and make the next focused edit.",
    summarize_context: "Summarize current findings before reading more files.",
    dispatch_readonly: `Generate ${suggestedBriefCount ?? 1} read-only delegation brief(s) with non-overlapping scope.`,
    ask_human: "Ask the user to clarify the goal before continuing."
  };

  return {
    recommendation,
    confidence,
    scores,
    reasons: reasons.length > 0 ? reasons : ["No delegation trigger was detected."],
    guardrails,
    suggested_next_step: suggestedNextStepByRecommendation[recommendation],
    suggested_brief_count: suggestedBriefCount
  };
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./schema.js";
export * from "./policy.js";
```

- [ ] **Step 4: Run policy tests**

Run:

```bash
npm test -- packages/core/tests/policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit policy engine**

Run:

```bash
git add packages/core/src packages/core/tests/policy.test.ts
git commit -m "feat: add delegation policy engine"
```

## Task 4: Implement Brief Generation and Quality Checks

**Files:**
- Create: `packages/core/src/briefs.ts`
- Create: `packages/core/tests/briefs.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write brief tests**

Create `packages/core/tests/briefs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assessBriefQuality, generateDelegationBriefs } from "../src/briefs";

describe("generateDelegationBriefs", () => {
  it("creates bounded readonly briefs from open questions", () => {
    const result = generateDelegationBriefs({
      task: "Fix slow auth tests",
      context_summary: "Auth tests are slow after session refactor.",
      files_read: [
        { path: "src/auth/session.ts", module: "auth" },
        { path: "tests/auth/fixtures.ts", module: "tests" }
      ],
      open_questions: [
        "Is runtime session refresh causing delay?",
        "Are fixtures creating expired sessions?"
      ],
      max_briefs: 2
    });

    expect(result.briefs).toHaveLength(2);
    expect(result.briefs[0].mode).toBe("readonly");
    expect(result.briefs[0].do_not_edit).toBeUndefined();
    expect(result.briefs[0].expected_output).toContain("Evidence");
  });

  it("returns no briefs when there are no bounded questions", () => {
    const result = generateDelegationBriefs({
      task: "Understand checkout",
      context_summary: "Need to understand checkout.",
      files_read: [{ path: "src/checkout/index.ts", module: "checkout" }],
      open_questions: [],
      max_briefs: 2
    });

    expect(result.briefs).toHaveLength(0);
    expect(result.reason).toContain("No open questions");
  });
});

describe("assessBriefQuality", () => {
  it("rejects broad briefs", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Understand everything",
        mode: "readonly",
        goal: "Understand the whole codebase",
        scope: {},
        context: "The main agent is confused.",
        questions: ["What is going on?"],
        expected_output: ["Summary"],
        budget: {},
        stop_conditions: ["Stop after reporting that the brief is too broad"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Goal is too broad.");
    expect(result.improved_brief).toBeNull();
  });

  it("accepts bounded readonly briefs", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate auth fixture setup",
        mode: "readonly",
        goal: "Determine whether auth fixtures create expired sessions.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Slow auth tests started after session refactor.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 3, max_minutes: 10 },
        stop_conditions: ["Stop after inspecting listed files", "Stop if write access is required"]
      }
    });

    expect(result.quality).toBe("pass");
  });
});
```

- [ ] **Step 2: Run brief tests and verify failure**

Run:

```bash
npm test -- packages/core/tests/briefs.test.ts
```

Expected: FAIL because `packages/core/src/briefs.ts` does not exist.

- [ ] **Step 3: Implement brief logic**

Create `packages/core/src/briefs.ts`:

```ts
import { z } from "zod";
import {
  AgentStateSchema,
  BriefQualityInputSchema,
  BriefQualityResult,
  DelegationBrief
} from "./schema.js";

const GenerateBriefsInputSchema = AgentStateSchema.extend({
  max_briefs: z.number().int().positive().max(3).default(3)
});

const DEFAULT_EXPECTED_OUTPUT = [
  "Status: done / blocked / needs_context",
  "Findings",
  "Evidence",
  "Relevant files/functions",
  "Open questions",
  "Recommended next step"
];

function filesForQuestion(question: string, files: Array<{ path: string; module?: string }>): string[] {
  const lower = question.toLowerCase();
  const matching = files.filter((file) => {
    const haystack = `${file.path} ${file.module ?? ""}`.toLowerCase();
    return lower
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4)
      .some((word) => haystack.includes(word));
  });
  return (matching.length > 0 ? matching : files).slice(0, 6).map((file) => file.path);
}

function titleForQuestion(question: string): string {
  const cleaned = question.replace(/[?!.]+$/g, "").trim();
  if (/^is |^are |^does |^do |^where |^why |^how /i.test(cleaned)) {
    return `Investigate ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }
  return `Investigate ${cleaned}`;
}

export function generateDelegationBriefs(input: unknown): {
  briefs: DelegationBrief[];
  reason?: string;
  suggested_next_step?: string;
} {
  const state = GenerateBriefsInputSchema.parse(input);
  const questions = state.open_questions.slice(0, state.max_briefs);

  if (questions.length === 0) {
    return {
      briefs: [],
      reason: "No open questions were provided, so no bounded read-only briefs can be generated.",
      suggested_next_step: "Continue with the main agent or summarize context before delegating."
    };
  }

  const briefs = questions.map((question) => {
    const scopedFiles = filesForQuestion(question, state.files_read);
    return {
      title: titleForQuestion(question),
      mode: "readonly" as const,
      goal: question,
      scope: {
        files: scopedFiles,
        exclude_files: []
      },
      context: state.context_summary ?? `Current task: ${state.task}`,
      questions: [question],
      expected_output: DEFAULT_EXPECTED_OUTPUT,
      budget: {
        max_files: Math.min(6, Math.max(1, scopedFiles.length || 3)),
        max_minutes: 10,
        max_tokens: 3000
      },
      stop_conditions: [
        "Do not edit files.",
        "Stop when the question can be answered with evidence.",
        "Stop and report needs_context if the required files are outside scope."
      ]
    };
  });

  return { briefs };
}

export function assessBriefQuality(input: unknown): BriefQualityResult {
  const { brief } = BriefQualityInputSchema.parse(input);
  const issues: string[] = [];

  if (/whole codebase|everything|all files|understand the codebase/i.test(brief.goal)) {
    issues.push("Goal is too broad.");
  }

  const scopedFileCount = brief.scope.files?.length ?? 0;
  const scopedModuleCount = brief.scope.modules?.length ?? 0;
  if (scopedFileCount === 0 && scopedModuleCount === 0) {
    issues.push("Scope must include at least one file or module.");
  }

  if (!brief.expected_output.some((item) => /evidence/i.test(item))) {
    issues.push("Expected output must require evidence.");
  }

  if (!brief.budget.max_files && !brief.budget.max_minutes && !brief.budget.max_tokens) {
    issues.push("Budget must include max_files, max_minutes, or max_tokens.");
  }

  if (brief.stop_conditions.length === 0) {
    issues.push("At least one stop condition is required.");
  }

  const impliesWrite = [brief.goal, ...brief.questions, ...brief.expected_output].some((text) =>
    /\b(edit|write|modify|patch|change|commit)\b/i.test(text)
  );
  if (impliesWrite) {
    issues.push("Brief implies write access, which is out of scope for v1.");
  }

  if (issues.length === 0) {
    return {
      quality: "pass",
      issues: [],
      improved_brief: null
    };
  }

  const canSuggestImprovedBrief = scopedFileCount > 0 || scopedModuleCount > 0;

  const improvedBrief: DelegationBrief | null = canSuggestImprovedBrief ? {
    ...brief,
    mode: "readonly",
    goal: issues.includes("Goal is too broad.")
      ? "Answer the listed bounded investigation question using evidence from the scoped files."
      : brief.goal,
    scope: brief.scope,
    expected_output: brief.expected_output.some((item) => /evidence/i.test(item))
      ? brief.expected_output
      : [...brief.expected_output, "Evidence"],
    budget:
      !brief.budget.max_files && !brief.budget.max_minutes && !brief.budget.max_tokens
        ? { ...brief.budget, max_files: 5, max_minutes: 10 }
        : brief.budget,
    stop_conditions:
      brief.stop_conditions.length === 0
        ? ["Do not edit files.", "Stop when the question can be answered with evidence."]
        : brief.stop_conditions
  } : null;

  return {
    quality: "needs_revision",
    issues,
    improved_brief: improvedBrief
  };
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./schema.js";
export * from "./policy.js";
export * from "./briefs.js";
```

- [ ] **Step 4: Run brief tests**

Run:

```bash
npm test -- packages/core/tests/briefs.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit brief logic**

Run:

```bash
git add packages/core/src packages/core/tests/briefs.test.ts
git commit -m "feat: add readonly brief generation"
```

## Task 5: Implement Result Summaries and Event Sessions

**Files:**
- Create: `packages/core/src/summary.ts`
- Create: `packages/core/src/redaction.ts`
- Create: `packages/core/src/events.ts`
- Create: `packages/core/tests/summary.test.ts`
- Create: `packages/core/tests/events.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write summary and event tests**

Create `packages/core/tests/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeSubagentResults } from "../src/summary";

describe("summarizeSubagentResults", () => {
  it("compresses findings and evidence", () => {
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: "Fixtures create expired sessions.",
          evidence: ["tests/auth/fixtures.ts:18"],
          recommended_next_steps: ["Inspect fixture expiry setup."]
        }
      ],
      target_tokens: 800
    });

    expect(summary.summary).toContain("Fixtures create expired sessions.");
    expect(summary.confirmed_findings[0].evidence).toContain("tests/auth/fixtures.ts:18");
    expect(summary.files_to_revisit).toContain("tests/auth/fixtures.ts");
  });

  it("preserves blocked status as an open question", () => {
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate runtime session refresh",
          status: "blocked",
          summary: "Could not inspect generated session code.",
          evidence: [],
          open_questions: ["Where is generated session code stored?"]
        }
      ],
      target_tokens: 800
    });

    expect(summary.open_questions).toContain("Where is generated session code stored?");
    expect(summary.confidence).toBe("low");
  });
});
```

Create `packages/core/tests/events.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInMemoryEventStore } from "../src/events";

describe("event store", () => {
  it("records safe events in a generated session", () => {
    const store = createInMemoryEventStore();
    const result = store.record({
      event: {
        type: "file_read",
        path: "src/auth/session.ts",
        summary: "Session validation logic"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.session_id).toMatch(/^session-/);
    expect(store.get(result.session_id).events).toHaveLength(1);
  });

  it("rejects secret-like summaries", () => {
    const store = createInMemoryEventStore();
    const result = store.record({
      event: {
        type: "error_seen",
        summary: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("event_rejected");
  });
});
```

- [ ] **Step 2: Run summary and event tests and verify failure**

Run:

```bash
npm test -- packages/core/tests/summary.test.ts packages/core/tests/events.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 3: Implement redaction**

Create `packages/core/src/redaction.ts`:

```ts
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /api[_-]?key\s*[:=]\s*[A-Za-z0-9_-]{16,}/i,
  /token\s*[:=]\s*[A-Za-z0-9_-]{16,}/i,
  /password\s*[:=]\s*\S{8,}/i
];

export function containsSecretLikeContent(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}
```

- [ ] **Step 4: Implement result summarizer**

Create `packages/core/src/summary.ts`:

```ts
import {
  SubagentResultInputSchema,
  SubagentResultSummary,
  SubagentResultSchema
} from "./schema.js";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function evidenceToFile(evidence: string): string {
  const lineIndex = evidence.indexOf(":");
  return lineIndex === -1 ? evidence : evidence.slice(0, lineIndex);
}

export function summarizeSubagentResults(input: unknown): SubagentResultSummary {
  const parsed = SubagentResultInputSchema.parse(input);
  const results = parsed.results.map((result) => SubagentResultSchema.parse(result));
  const confirmed = results.filter((result) => result.status === "done");
  const blocked = results.filter((result) => result.status !== "done");
  const allEvidence = unique(results.flatMap((result) => result.evidence));
  const filesToRevisit = unique(allEvidence.map(evidenceToFile));
  const openQuestions = unique([
    ...results.flatMap((result) => result.open_questions),
    ...blocked.map((result) => `${result.brief_title}: ${result.summary}`)
  ]);
  const nextSteps = unique(results.flatMap((result) => result.recommended_next_steps));

  const summaryParts = results.map((result) => `${result.brief_title}: ${result.summary}`);
  const summary = summaryParts.join(" ");

  return {
    summary,
    confirmed_findings: confirmed.map((result) => ({
      summary: result.summary,
      evidence: result.evidence
    })),
    conflicts_or_disagreements: [],
    open_questions: openQuestions,
    recommended_next_steps: nextSteps,
    files_to_revisit: filesToRevisit,
    confidence: blocked.length > 0 ? "low" : confirmed.length === results.length ? "high" : "medium"
  };
}
```

- [ ] **Step 5: Implement event store**

Create `packages/core/src/events.ts`:

```ts
import { RecordEventInput, RecordEventInputSchema, AgentEvent } from "./schema.js";
import { containsSecretLikeContent } from "./redaction.js";

export type RecordEventResult =
  | { ok: true; session_id: string }
  | { ok: false; error: "event_rejected"; reason: string };

export type EventSession = {
  session_id: string;
  events: AgentEvent[];
};

export type EventStore = {
  record(input: RecordEventInput): RecordEventResult;
  get(sessionId: string): EventSession;
  clear(sessionId: string): void;
};

let sessionCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `session-${sessionCounter}`;
}

export function createInMemoryEventStore(): EventStore {
  const sessions = new Map<string, EventSession>();

  return {
    record(input: RecordEventInput): RecordEventResult {
      const parsed = RecordEventInputSchema.parse(input);

      if (containsSecretLikeContent(parsed.event)) {
        return {
          ok: false,
          error: "event_rejected",
          reason: "Event appears to include secret-like content. Store a redacted summary instead."
        };
      }

      const sessionId = parsed.session_id ?? nextSessionId();
      const existing = sessions.get(sessionId) ?? { session_id: sessionId, events: [] };
      const event = {
        ...parsed.event,
        timestamp: parsed.event.timestamp ?? new Date().toISOString()
      };
      existing.events.push(event);
      sessions.set(sessionId, existing);

      return { ok: true, session_id: sessionId };
    },
    get(sessionId: string): EventSession {
      return sessions.get(sessionId) ?? { session_id: sessionId, events: [] };
    },
    clear(sessionId: string): void {
      sessions.delete(sessionId);
    }
  };
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./schema.js";
export * from "./policy.js";
export * from "./briefs.js";
export * from "./summary.js";
export * from "./events.js";
export * from "./redaction.js";
```

- [ ] **Step 6: Run summary and event tests**

Run:

```bash
npm test -- packages/core/tests/summary.test.ts packages/core/tests/events.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit summary and events**

Run:

```bash
git add packages/core/src packages/core/tests/summary.test.ts packages/core/tests/events.test.ts
git commit -m "feat: add result summaries and event sessions"
```

## Task 6: Implement MCP Server Tools

**Files:**
- Create: `packages/mcp-server/src/server.ts`
- Create: `packages/mcp-server/src/index.ts`

- [ ] **Step 1: Write MCP server wrapper**

Create `packages/mcp-server/src/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AgentStateSchema,
  BriefQualityInputSchema,
  RecordEventInputSchema,
  SubagentResultInputSchema,
  assessBriefQuality,
  assessDelegationNeed,
  createInMemoryEventStore,
  generateDelegationBriefs,
  summarizeSubagentResults
} from "@agent-delegate/core";

function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function createAgentDelegateServer(): McpServer {
  const server = new McpServer({
    name: "agent-delegate",
    version: "0.1.0"
  });
  const eventStore = createInMemoryEventStore();

  server.tool(
    "record_event",
    "Record a lightweight local session event for delegation analysis.",
    RecordEventInputSchema.shape,
    async (input) => jsonContent(eventStore.record(input))
  );

  server.tool(
    "assess_delegation_need",
    "Assess whether the main agent should continue, summarize, dispatch read-only subagents, or ask the user.",
    AgentStateSchema.shape,
    async (input) => jsonContent(assessDelegationNeed(input))
  );

  server.tool(
    "generate_delegation_briefs",
    "Generate bounded read-only subagent briefs from current agent state.",
    AgentStateSchema.extend({
      max_briefs: z.number().int().positive().max(3).default(3)
    }).shape,
    async (input) => jsonContent(generateDelegationBriefs(input))
  );

  server.tool(
    "assess_brief_quality",
    "Check whether a read-only delegation brief is specific and safe enough to dispatch.",
    BriefQualityInputSchema.shape,
    async (input) => jsonContent(assessBriefQuality(input))
  );

  server.tool(
    "summarize_subagent_results",
    "Compress subagent results into compact main-agent context.",
    SubagentResultInputSchema.shape,
    async (input) => jsonContent(summarizeSubagentResults(input))
  );

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createAgentDelegateServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

Create `packages/mcp-server/src/index.ts`:

```ts
#!/usr/bin/env node
export * from "./server.js";

import { runStdioServer } from "./server.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Typecheck MCP server**

Run:

```bash
npm run typecheck
```

Expected: PASS. If the MCP SDK tool registration API differs, update `server.tool(...)` calls to the equivalent current v1 SDK API while preserving the five tool names, input schemas, and JSON text responses.

- [ ] **Step 3: Build MCP server**

Run:

```bash
npm run build --workspace @agent-delegate/mcp-server
```

Expected: PASS and `packages/mcp-server/dist/index.js` exists.

- [ ] **Step 4: Commit MCP server**

Run:

```bash
git add packages/mcp-server
git commit -m "feat: expose delegation tools over MCP"
```

## Task 7: Implement CLI and Rules Pack

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/analyze.ts`
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/serve.ts`
- Create: `packages/cli/tests/analyze.test.ts`
- Create: `packages/cli/tests/init.test.ts`
- Create: `packages/rules/codex/AGENTS.fragment.md`
- Create: `packages/rules/claude-code/CLAUDE.fragment.md`
- Create: `packages/rules/generic/agent-delegate-rules.md`
- Create: `examples/agent-state.sample.json`
- Create: `examples/subagent-result.sample.json`

- [ ] **Step 1: Write CLI tests**

Create `packages/cli/tests/analyze.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeAgentStateJson } from "../src/commands/analyze";

describe("analyzeAgentStateJson", () => {
  it("returns a delegation assessment JSON string", () => {
    const output = analyzeAgentStateJson(
      JSON.stringify({
        task: "Fix slow auth tests",
        current_phase: "investigation",
        context_summary: "Read auth runtime and tests.",
        files_read: Array.from({ length: 8 }, (_, index) => ({
          path: `file-${index}.ts`,
          module: index < 4 ? "auth" : "tests"
        })),
        open_questions: ["Is runtime slow?", "Are fixtures invalid?"],
        metrics: { turns_without_write: 4 }
      })
    );

    expect(JSON.parse(output).recommendation).toBe("dispatch_readonly");
  });
});
```

Create `packages/cli/tests/init.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rulesForTarget } from "../src/commands/init";

describe("rulesForTarget", () => {
  it("returns Codex rules", () => {
    expect(rulesForTarget("codex")).toContain("assess_delegation_need");
  });

  it("rejects unknown targets", () => {
    expect(() => rulesForTarget("unknown")).toThrow("Unsupported init target");
  });
});
```

- [ ] **Step 2: Run CLI tests and verify failure**

Run:

```bash
npm test -- packages/cli/tests/analyze.test.ts packages/cli/tests/init.test.ts
```

Expected: FAIL because CLI command files do not exist.

- [ ] **Step 3: Implement analyze command**

Create `packages/cli/src/commands/analyze.ts`:

```ts
import { readFileSync } from "node:fs";
import { assessDelegationNeed } from "@agent-delegate/core";

export function analyzeAgentStateJson(json: string): string {
  const parsed = JSON.parse(json);
  return JSON.stringify(assessDelegationNeed(parsed), null, 2);
}

export function analyzeCommand(path: string): void {
  const json = readFileSync(path, "utf8");
  process.stdout.write(`${analyzeAgentStateJson(json)}\n`);
}
```

- [ ] **Step 4: Implement init command and rules templates**

Create `packages/cli/src/commands/init.ts`:

```ts
const BASE_RULES = `# agent-delegate Rules

When investigation grows beyond a small local edit, call the agent-delegate MCP tool assess_delegation_need.

Trigger examples:
- You have read 8+ files without implementation.
- You have 2+ independent open questions.
- You are about to inspect another module after already inspecting two.
- You have multiple failing tests in different files.
- Your context summary is stale or too long.

Tool sequence:
1. Call assess_delegation_need.
2. If recommendation is dispatch_readonly, call generate_delegation_briefs.
3. Call assess_brief_quality before dispatching each brief.
4. After subagents return, call summarize_subagent_results.

Prefer read-only delegation. Do not request write-code subagents in v1.
`;

const TARGET_HEADERS: Record<string, string> = {
  codex: "# Codex AGENTS.md Fragment\n\n",
  "claude-code": "# Claude Code CLAUDE.md Fragment\n\n",
  generic: "# Generic Agent Rules\n\n"
};

export function rulesForTarget(target: string): string {
  const header = TARGET_HEADERS[target];
  if (!header) {
    throw new Error(`Unsupported init target: ${target}`);
  }
  return `${header}${BASE_RULES}`;
}

export function initCommand(target: string): void {
  process.stdout.write(rulesForTarget(target));
}
```

Create `packages/rules/codex/AGENTS.fragment.md`:

```md
# agent-delegate Rules

When investigation grows beyond a small local edit, call the `agent-delegate` MCP tool `assess_delegation_need`.

Trigger examples:
- You have read 8+ files without implementation.
- You have 2+ independent open questions.
- You are about to inspect another module after already inspecting two.
- You have multiple failing tests in different files.
- Your context summary is stale or too long.

Tool sequence:
1. Call `assess_delegation_need`.
2. If recommendation is `dispatch_readonly`, call `generate_delegation_briefs`.
3. Call `assess_brief_quality` before dispatching each brief.
4. After subagents return, call `summarize_subagent_results`.

Prefer read-only delegation. Do not request write-code subagents in v1.
```

Create `packages/rules/claude-code/CLAUDE.fragment.md`:

```md
# agent-delegate Rules

When investigation grows beyond a small local edit, call the `agent-delegate` MCP tool `assess_delegation_need`.

Trigger examples:
- You have read 8+ files without implementation.
- You have 2+ independent open questions.
- You are about to inspect another module after already inspecting two.
- You have multiple failing tests in different files.
- Your context summary is stale or too long.

Tool sequence:
1. Call `assess_delegation_need`.
2. If recommendation is `dispatch_readonly`, call `generate_delegation_briefs`.
3. Call `assess_brief_quality` before dispatching each brief.
4. After subagents return, call `summarize_subagent_results`.

Prefer read-only delegation. Do not request write-code subagents in v1.
```

Create `packages/rules/generic/agent-delegate-rules.md`:

```md
# agent-delegate Rules

When investigation grows beyond a small local edit, call the `agent-delegate` MCP tool `assess_delegation_need`.

Trigger examples:
- You have read 8+ files without implementation.
- You have 2+ independent open questions.
- You are about to inspect another module after already inspecting two.
- You have multiple failing tests in different files.
- Your context summary is stale or too long.

Tool sequence:
1. Call `assess_delegation_need`.
2. If recommendation is `dispatch_readonly`, call `generate_delegation_briefs`.
3. Call `assess_brief_quality` before dispatching each brief.
4. After subagents return, call `summarize_subagent_results`.

Prefer read-only delegation. Do not request write-code subagents in v1.
```

- [ ] **Step 5: Implement serve command and CLI entrypoint**

Create `packages/cli/src/commands/serve.ts`:

```ts
import { runStdioServer } from "@agent-delegate/mcp-server";

export async function serveCommand(): Promise<void> {
  await runStdioServer();
}
```

Create `packages/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { analyzeCommand } from "./commands/analyze.js";
import { initCommand } from "./commands/init.js";
import { serveCommand } from "./commands/serve.js";

async function main(argv: string[]): Promise<void> {
  const [command, arg] = argv;

  if (command === "serve") {
    await serveCommand();
    return;
  }

  if (command === "analyze" && arg) {
    analyzeCommand(arg);
    return;
  }

  if (command === "init" && arg) {
    initCommand(arg);
    return;
  }

  process.stderr.write(
    "Usage: agent-delegate <serve | analyze <agent-state.json> | init <codex|claude-code|generic>>\n"
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 6: Add examples**

Create `examples/agent-state.sample.json`:

```json
{
  "task": "Fix slow auth tests after session refactor",
  "current_phase": "investigation",
  "context_summary": "The main agent has inspected auth runtime, middleware, fixtures, and test helpers. No implementation has started.",
  "files_read": [
    { "path": "src/auth/session.ts", "module": "auth", "summary": "Session validation and refresh logic", "tokens_estimate": 1200 },
    { "path": "src/auth/middleware.ts", "module": "auth", "summary": "Auth middleware path", "tokens_estimate": 900 },
    { "path": "tests/auth/fixtures.ts", "module": "tests", "summary": "Auth test fixture setup", "tokens_estimate": 800 },
    { "path": "tests/auth/session.test.ts", "module": "tests", "summary": "Slow test cases", "tokens_estimate": 1000 },
    { "path": "tests/helpers/time.ts", "module": "tests", "summary": "Time helpers", "tokens_estimate": 500 },
    { "path": "src/config/auth.ts", "module": "config", "summary": "Auth config defaults", "tokens_estimate": 400 },
    { "path": "src/http/cookies.ts", "module": "http", "summary": "Cookie handling", "tokens_estimate": 600 },
    { "path": "src/auth/token.ts", "module": "auth", "summary": "Token parsing", "tokens_estimate": 700 }
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

Create `examples/subagent-result.sample.json`:

```json
{
  "task": "Fix slow auth tests after session refactor",
  "results": [
    {
      "brief_title": "Investigate fixture setup",
      "status": "done",
      "summary": "Fixtures create expired sessions before the assertion path runs.",
      "evidence": ["tests/auth/fixtures.ts:18"],
      "open_questions": [],
      "recommended_next_steps": ["Inspect fixture expiry setup in the main agent."]
    }
  ],
  "target_tokens": 800
}
```

- [ ] **Step 7: Run CLI tests**

Run:

```bash
npm test -- packages/cli/tests/analyze.test.ts packages/cli/tests/init.test.ts
```

Expected: PASS.

- [ ] **Step 8: Verify CLI analyze**

Run:

```bash
npm run agent-delegate -- analyze examples/agent-state.sample.json
```

Expected: JSON output with `"recommendation": "dispatch_readonly"`.

- [ ] **Step 9: Commit CLI and rules**

Run:

```bash
git add packages/cli packages/rules examples
git commit -m "feat: add CLI and rules pack"
```

## Task 8: Add README and Final Verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:

```md
# agent-delegate

`agent-delegate` is an MCP-first delegation advisor for coding agents. It helps a main agent decide when to delegate read-only investigation, generate bounded subagent briefs, and summarize subagent results back into compact main-agent context.

## Status

This repository implements v1: Read-only Delegation Advisor.

v1 does not execute write-code subagents, edit files on behalf of agents, run background monitoring, or orchestrate worktrees.

## Install

```bash
npm install
```

## Run the MCP Server

```bash
npm run agent-delegate -- serve
```

Configure your agent tool to launch that command as a local MCP server.

## Analyze a Sample Agent State

```bash
npm run agent-delegate -- analyze examples/agent-state.sample.json
```

Expected output includes a recommendation such as:

```json
{
  "recommendation": "dispatch_readonly"
}
```

## Generate Rules

```bash
npm run agent-delegate -- init codex
npm run agent-delegate -- init claude-code
npm run agent-delegate -- init generic
```

## MCP Tools

- `record_event`
- `assess_delegation_need`
- `generate_delegation_briefs`
- `assess_brief_quality`
- `summarize_subagent_results`

## Development

```bash
npm test
npm run typecheck
npm run build
```

## Roadmap

- v1: Read-only Delegation Advisor
- v2: Write-readiness Assessor
- v3: Controlled Write-agent Delegation
- v4: Parallel Write-agent Orchestration
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run sample CLI command**

Run:

```bash
npm run agent-delegate -- analyze examples/agent-state.sample.json
```

Expected: JSON output with `"recommendation": "dispatch_readonly"`.

- [ ] **Step 6: Commit README and verification cleanup**

Run:

```bash
git add README.md
git commit -m "docs: add project README"
```

## Execution Notes

Before implementation starts, the executor should install Node dependencies with `npm install`. This requires network access and should be approved by the user when running in a restricted Codex environment.

Use frequent commits exactly as listed in each task. If the MCP SDK tool API has changed, preserve the same tool names and behavior while adapting only the server registration syntax.
