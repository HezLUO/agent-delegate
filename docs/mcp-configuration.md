# MCP Configuration

`agent-delegate` is designed to be launched as a local MCP stdio server.

## Server Command

Use the silent npm command so MCP stdout is not polluted by npm lifecycle output:

```bash
npm run --silent agent-delegate -- serve
```

## Generic MCP Configuration

Use this shape in tools that support local stdio MCP servers:

```json
{
  "mcpServers": {
    "agent-delegate": {
      "command": "npm",
      "args": ["run", "--silent", "agent-delegate", "--", "serve"],
      "cwd": "/absolute/path/to/agent-delegate"
    }
  }
}
```

Replace `/absolute/path/to/agent-delegate` with this repository path.

## Local Doctor Check

Run:

```bash
npm run agent-delegate -- doctor
```

The command verifies:

- Dependencies are installed.
- The local MCP server can be launched through stdio.
- All five v1 MCP tools are visible to an MCP client.
- The copyable MCP configuration uses the current repository path.

Passing `doctor` proves the server works as an MCP stdio server from this repository. It does not prove that a specific agent app has loaded the MCP configuration.

## Agent Visibility Check

After adding the MCP configuration to an agent app, start a fresh agent session and ask it to confirm that these tool names are available:

- `record_event`
- `assess_delegation_need`
- `generate_delegation_briefs`
- `assess_brief_quality`
- `summarize_subagent_results`

If `doctor` passes but the agent cannot see those tools, treat it as an agent-app configuration problem first. Check that the app is using the same `cwd`, command, and arguments shown by `doctor`, then restart or recreate the agent session.

## Tools

The server exposes:

- `record_event`
- `assess_delegation_need`
- `generate_delegation_briefs`
- `assess_brief_quality`
- `summarize_subagent_results`

## First Call

Start with `assess_delegation_need` using a compact `AgentState`:

```json
{
  "task": "Fix slow auth tests after session refactor",
  "current_phase": "investigation",
  "context_summary": "Read auth runtime, fixtures, and tests. No implementation has started.",
  "files_read": [
    { "path": "src/auth/session.ts", "module": "auth" },
    { "path": "tests/auth/fixtures.ts", "module": "tests" }
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

## Important Boundary

v1 only supports read-only delegation advice. It does not execute write-code subagents.
