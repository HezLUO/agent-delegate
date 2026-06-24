# agent-delegate Design

Date: 2026-06-24

## Summary

`agent-delegate` is an MCP-first delegation advisor for coding agents. It helps a main agent decide when to delegate read-only investigation to subagents, generate bounded subagent briefs, and compress subagent results back into the main-agent context.

The v1 product is for advanced users who can configure MCP tools in agent environments such as Codex, Claude Code, Cursor, or similar coding-agent products. It is not a background monitor and it does not execute write-code subagents.

## Problem

Coding agents often spend a long time reading files, inspecting logs, and investigating related modules before implementation starts. As that happens, the main agent context grows, later responses become slower and more expensive, and the agent may miss the point where the work should have been split into focused subagent investigations.

The product should help the agent notice this situation earlier, evaluate whether read-only delegation is appropriate, and produce useful delegation briefs without forcing a platform-specific workflow.

## Goals

- Provide an agent-callable MCP tool layer for delegation decisions.
- Help agents decide when to continue, summarize context, dispatch read-only subagents, or ask the user.
- Generate bounded read-only subagent briefs with clear scope, questions, expected output, and budget.
- Check delegation briefs before they are used.
- Summarize subagent results into compact main-agent context.
- Support both stateless calls and optional session event recording.
- Provide a thin development CLI for serving MCP, offline analysis, and rules-pack initialization.
- Keep the product agent-agnostic and local-first.

## Non-Goals

- Background monitoring of agent activity.
- Automatic subagent dispatch.
- Write-code subagent execution in v1.
- Parallel write-agent orchestration.
- Git worktree or branch management.
- Automatic code changes, merges, or reviews.
- GUI dashboard.
- Hosted SaaS.
- Storing full source code or full command output by default.

## Target Users

The first target users are advanced coding-agent users who can configure MCP servers and are comfortable adding rules or prompts to their agent setup. They want a reusable tool that works across agent products rather than a Codex-only skill or a single-platform plugin.

## Product Shape

The selected product approach is MCP-first with a thin development CLI.

The MCP server is the primary product interface. The CLI exists to start the MCP server, analyze sample state files, and generate rules snippets. Rules packs teach agents when to call the MCP tools.

```text
Coding Agent
  -> agent-delegate MCP Server
    -> Core Policy Engine
    -> Schema Validation
    -> Brief Generator
    -> Brief Quality Checker
    -> Result Summarizer

Dev CLI
  -> serve
  -> analyze
  -> init

Rules Pack
  -> codex
  -> claude-code
  -> generic
```

## v1 Scope

v1 is a read-only delegation advisor.

In scope:

- MCP server.
- Core policy engine.
- Hybrid context model.
- Five MCP tools.
- Read-only delegation briefs.
- Brief quality assessment.
- Subagent result summarization.
- Thin CLI.
- Rules packs for Codex, Claude Code, and generic agents.
- Local-first storage for optional session events.

Out of scope:

- Write-code subagent delegation.
- Automatic background monitoring.
- Automatic dispatch.
- Automatic file edits.
- Worktree orchestration.
- Platform-specific GUI integrations.

## Context Model

v1 uses a hybrid context model.

The primary path is stateless. The agent passes the current task state directly to tools such as `assess_delegation_need`. This keeps the product portable across platforms and makes privacy boundaries explicit.

The enhanced path is stateful. The agent can call `record_event` during the task so the MCP server can maintain a lightweight session. This can improve recommendations, but v1 must remain fully usable without event recording.

## MCP Tools

### `record_event`

Records optional lightweight session events.

Example input:

```json
{
  "session_id": "optional-session-id",
  "event": {
    "type": "file_read",
    "path": "src/auth/session.ts",
    "summary": "Session validation and refresh logic",
    "tokens_estimate": 1200
  }
}
```

Supported event types:

```text
task_started
file_read
command_run
test_run
file_written
error_seen
question_identified
plan_created
delegation_decision
```

The server stores summaries, paths, statuses, timestamps, and token estimates. It does not store full file contents by default.

### `assess_delegation_need`

Evaluates whether the agent should continue, summarize context, dispatch read-only subagents, or ask the user.

Example recommendations:

```text
continue_main_agent
summarize_context
dispatch_readonly
ask_human
```

Example output:

```json
{
  "recommendation": "dispatch_readonly",
  "confidence": "medium",
  "scores": {
    "dispatch_readonly": 8,
    "summarize_context": 5,
    "continue_main_agent": 2,
    "ask_human": 1
  },
  "reasons": [
    "The agent has read 11 files across 3 modules without implementation",
    "There are 3 separable open questions",
    "The task can be split into read-only investigations"
  ],
  "guardrails": [
    {
      "name": "overlap_risk",
      "severity": "medium",
      "detail": "Two proposed investigations may both inspect auth middleware"
    }
  ],
  "suggested_next_step": "Generate 2 read-only briefs with non-overlapping scopes."
}
```

### `generate_delegation_briefs`

Generates one to three bounded read-only subagent briefs.

Each brief includes:

- Title.
- Mode.
- Goal.
- Scope.
- Context.
- Questions.
- Expected output.
- Budget.
- Stop conditions.

v1 only supports `readonly` mode.

### `assess_brief_quality`

Checks whether a delegation brief is safe and specific enough to use.

The checker verifies:

- The brief has one clear goal.
- The mode is explicit.
- The scope is bounded.
- Expected output includes evidence.
- Budget or stop conditions are present.
- The prompt avoids broad requests such as "understand the whole codebase".
- The brief does not imply write permission.

The tool returns `pass` or `needs_revision`, with issues and an optional improved brief.

### `summarize_subagent_results`

Compresses one or more subagent results into a short main-agent summary.

The output includes:

- Summary.
- Confirmed findings.
- Conflicts or disagreements.
- Open questions.
- Recommended next steps.
- Files to revisit.
- Confidence.

## Data Model

### `AgentState`

`AgentState` is the primary stateless input for `assess_delegation_need`.

```ts
type AgentState = {
  task: string
  current_phase: "planning" | "investigation" | "implementation" | "debugging" | "review" | "verification"
  context_summary?: string
  files_read?: FileObservation[]
  commands_run?: CommandObservation[]
  files_written?: string[]
  open_questions?: string[]
  findings?: Finding[]
  constraints?: DelegationConstraints
}
```

`files_read` carries observations rather than source content.

```ts
type FileObservation = {
  path: string
  summary?: string
  module?: string
  tokens_estimate?: number
}
```

### `AgentEvent`

`AgentEvent` powers the optional stateful path.

Events are lightweight and local by default. They include type, timestamp, summary, relevant path or command fields, status where applicable, and token estimate where known.

### `DelegationAssessment`

```ts
type DelegationAssessment = {
  recommendation:
    | "continue_main_agent"
    | "summarize_context"
    | "dispatch_readonly"
    | "ask_human"
  confidence: "low" | "medium" | "high"
  scores: Record<string, number>
  reasons: string[]
  guardrails: GuardrailHit[]
  suggested_next_step: string
  suggested_brief_count?: number
}
```

### `DelegationBrief`

```ts
type DelegationBrief = {
  title: string
  mode: "readonly"
  goal: string
  scope: {
    files?: string[]
    modules?: string[]
    exclude_files?: string[]
  }
  context: string
  questions: string[]
  expected_output: string[]
  budget: {
    max_files?: number
    max_minutes?: number
    max_tokens?: number
  }
  stop_conditions: string[]
}
```

Default expected output:

```text
Status: done / blocked / needs_context
Findings
Evidence
Relevant files/functions
Open questions
Recommended next step
```

### `SubagentResultSummary`

```ts
type SubagentResultSummary = {
  summary: string
  confirmed_findings: Finding[]
  conflicts_or_disagreements: string[]
  open_questions: string[]
  recommended_next_steps: string[]
  files_to_revisit: string[]
  confidence: "low" | "medium" | "high"
}
```

## Policy Engine

v1 uses transparent heuristic scoring rather than ML.

Triggers that increase `dispatch_readonly`:

```text
files_read_count >= 8
turns_without_write >= 3
investigation_minutes >= 10
open_questions_count >= 2
modules_touched_count >= 2
tool_output_tokens_estimate >= 6000
same_question_repeated >= 2
tests_failures_in_independent_files >= 2
```

Triggers that increase `summarize_context`:

```text
context_summary_missing_or_stale
tool_output_tokens_estimate >= 10000
many_findings_but_no_plan
subagent_results_need_compression
```

Triggers that increase `continue_main_agent`:

```text
files_read_count <= 3
single_file_or_single_module_scope
implementation_path_is_clear
one_obvious_next_edit
recent_file_write_happened
```

Triggers that increase `ask_human`:

```text
user_goal_ambiguous
destructive_or_external_action_needed
product_or_architecture_decision_needed
agent_cannot_form_clear_brief
```

Guardrails that block or downgrade delegation:

```text
Brief would be vague or broad
Likely root cause is in one shared module
Subagents would need write access
Subagents would inspect highly overlapping files
The problem requires one continuous design judgment
Current context is insufficient to form a bounded question
```

When uncertain, v1 should prefer `summarize_context` over `dispatch_readonly`.

Example policy configuration:

```yaml
investigation:
  max_files_before_check: 8
  max_turns_without_write: 3
  max_minutes_before_check: 10
  max_tool_output_tokens: 6000

delegation:
  max_readonly_briefs: 3
  allow_write_agents: false
  default_recommendation_when_uncertain: summarize_context
```

## CLI

The CLI is a development and integration aid, not the core product.

Commands:

```bash
agent-delegate serve
agent-delegate analyze sample-state.json
agent-delegate init codex
agent-delegate init claude-code
agent-delegate init generic
```

`serve` starts the MCP server. `analyze` runs policy evaluation against a JSON `AgentState`. `init` prints or writes rules snippets for the selected target.

## Rules Pack

Rules packs tell agents when to call the MCP tools.

Example rules:

```text
When investigation grows beyond a small local edit, call assess_delegation_need.

Trigger examples:
- You have read 8+ files without implementation.
- You have 2+ independent open questions.
- You are about to inspect another module after already inspecting two.
- You have multiple failing tests in different files.
- Your context summary is stale or too long.

Prefer read-only delegation. Do not request write-code subagents in v1.
```

Recommended tool sequence:

```text
1. assess_delegation_need
2. generate_delegation_briefs if recommendation is dispatch_readonly
3. assess_brief_quality before dispatching
4. summarize_subagent_results after agents return
```

## Repository Structure

```text
agent-delegate/
  package.json
  tsconfig.json
  README.md
  LICENSE
  docs/
    design/
    mcp-tools.md
    policies.md
    adapters.md
  examples/
    agent-state.sample.json
    subagent-result.sample.json
  packages/
    core/
      src/
        schema/
        policy/
        brief/
        summary/
      tests/
    mcp-server/
      src/
        server.ts
        tools/
      tests/
    cli/
      src/
        commands/
      tests/
    rules/
      codex/
      claude-code/
      generic/
```

Package responsibilities:

- `packages/core`: schema, policy scoring, brief generation, and result summarization. No MCP dependency.
- `packages/mcp-server`: exposes core functions as MCP tools and validates requests.
- `packages/cli`: provides `serve`, `analyze`, and `init`.
- `packages/rules`: contains rules templates for supported agent tools.

## Workflows

### Primary Workflow

1. User starts a task in a coding agent.
2. Rules pack prompts the agent to call `assess_delegation_need` when investigation exceeds thresholds.
3. Agent passes current `AgentState`.
4. MCP returns a recommendation.
5. If the recommendation is `dispatch_readonly`, the agent calls `generate_delegation_briefs`.
6. Agent calls `assess_brief_quality` for each brief.
7. Agent dispatches read-only subagents through its own platform.
8. Subagents return results.
9. Agent calls `summarize_subagent_results`.
10. Main agent continues with a compact summary instead of raw investigation context.

### Enhanced Workflow

Agents with deeper integration can call `record_event` as the task progresses. Later assessment can use a `session_id` plus concise context instead of a complete stateless state object.

## Error Handling

If input is insufficient, `assess_delegation_need` should return `ask_human` or a low-confidence recommendation with a clear reason.

If a task cannot be split, `generate_delegation_briefs` should return no briefs and explain why.

If a brief is broad or unsafe, `assess_brief_quality` should return `needs_revision` and an improved brief where possible.

If an event appears to include secrets or full sensitive content, `record_event` should reject it and ask for a redacted summary.

If subagent results conflict, `summarize_subagent_results` should preserve the disagreement rather than forcing a single conclusion.

## Security and Privacy

v1 is local-first.

Rules:

- Do not store full file contents by default.
- Do not store complete command output by default.
- Reject or redact secret-like content.
- Allow session reset.
- Keep MCP and CLI output free of hidden reasoning.
- Return reasons, scores, risks, and recommendations only.

## Testing Strategy

v1 tests should focus on policy reliability and contract stability.

Test categories:

- Schema validation tests.
- Policy fixture tests:
  - small local task returns `continue_main_agent`
  - long investigation returns `dispatch_readonly`
  - huge context without clear split returns `summarize_context`
  - ambiguous goal returns `ask_human`
- Brief quality tests:
  - broad brief is rejected
  - bounded read-only brief passes
- MCP tool contract tests.
- CLI snapshot tests for `analyze`.

## Roadmap

### v1: Read-only Delegation Advisor

MCP-first advisor for deciding when to delegate read-only investigation.

### v2: Write-readiness Assessor

Adds assessment for whether a task is ready for write-code delegation, without directly executing write-code subagents.

Likely additions:

- `assess_write_delegation_readiness`
- Editable file scope checks.
- Test requirement checks.
- Conflict risk checks.
- Write brief drafts that are not automatically approved.

### v3: Controlled Write-agent Delegation

Supports controlled write-code subagent delegation.

Constraints:

- One write-code agent by default.
- Explicit allow/edit/deny file scopes.
- Required verification commands.
- Required review and integration summary.
- No default parallel write execution.

### v4: Parallel Write-agent Orchestration

Supports multiple write-code agents in parallel.

Likely additions:

- Worktree or branch isolation.
- Automatic conflict detection.
- Review chain.
- Integration plan.
- Optional automatic merge for low-risk changes.

## Open Implementation Decisions

The design intentionally leaves these decisions for the implementation plan:

- Exact MCP SDK.
- Package manager.
- Final numeric policy thresholds.
- Rules-pack file names and installation behavior.
- Local session storage format.

## Success Criteria

v1 is successful if:

- Agents call the tool before investigation context becomes excessive.
- Recommendations are explainable and conservative.
- Generated briefs are specific enough for useful read-only subagent work.
- Main agents can carry compact subagent summaries instead of raw investigation context.
- Advanced users can configure the MCP server across multiple agent tools.
