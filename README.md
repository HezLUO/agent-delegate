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
npm run --silent agent-delegate -- serve
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
