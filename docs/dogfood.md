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
npm run agent-delegate -- doctor
npm run smoke:mcp
npm run check:fixtures
```

`npm run check:fixtures` asserts the expected recommendations for the dogfood fixtures:

| Fixture | Expected recommendation |
| --- | --- |
| `examples/dogfood-long-investigation.json` | `dispatch_readonly` |
| `examples/dogfood-small-edit.json` | `continue_main_agent` |
| `examples/dogfood-ambiguous-goal.json` | `ask_human` |

You can inspect fixture output manually with:

```bash
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

## Real Agent Trial

Configure the MCP server in one agent tool, then start a real coding task that requires investigation.

Launch the MCP server with:

```bash
npm run --silent agent-delegate -- serve
```

The agent should call:

1. `record_event` to record meaningful investigation progress or observations.
2. `assess_delegation_need` after investigation grows beyond a small local edit.
3. `generate_delegation_briefs` if the recommendation is `dispatch_readonly`.
4. `assess_brief_quality` before dispatching a brief.
5. `summarize_subagent_results` after read-only subagents return.

Record each real trial in [dogfood-results.md](dogfood-results.md). If `doctor` passes but the agent cannot see the MCP tools, record that as a configuration failure rather than a passed dogfood run.

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
