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

## Check MCP Setup

```bash
npm run agent-delegate -- doctor
```

`doctor` verifies that dependencies are installed, the local MCP server can start, and all five v1 MCP tools are visible through stdio. It also prints a copyable MCP configuration.

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
npm run check:fixtures
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

## Documentation

- [Dogfood protocol](docs/dogfood.md)
- [Dogfood results](docs/dogfood-results.md)
- [MCP configuration](docs/mcp-configuration.md)
- [Release checklist](docs/release-checklist.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

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
