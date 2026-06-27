# Contributing

Thanks for your interest in `agent-delegate`.

## Project Scope

The current implementation is v1: a read-only delegation advisor for coding agents.

In scope:

- MCP tools for delegation assessment.
- Read-only subagent brief generation.
- Brief quality checks.
- Subagent result summarization.
- Local dogfood and smoke-test workflows.

Out of scope for v1:

- Write-code subagent execution.
- Background monitoring.
- Automatic dispatch.
- Git worktree orchestration.
- Hosted services.

## Development

Install dependencies:

```bash
npm install
```

Run verification:

```bash
npm test
npm run typecheck
npm run build
npm run smoke:mcp
```

Run dogfood fixtures:

```bash
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Expected recommendations:

- `dogfood-long-investigation.json` -> `dispatch_readonly`
- `dogfood-small-edit.json` -> `continue_main_agent`
- `dogfood-ambiguous-goal.json` -> `ask_human`

## Pull Requests

Keep changes small and scoped. Include tests or dogfood coverage when behavior changes.

Before opening a pull request, run:

```bash
npm test
npm run typecheck
npm run build
```

If the change affects MCP stdio behavior, also run:

```bash
npm run smoke:mcp
```
