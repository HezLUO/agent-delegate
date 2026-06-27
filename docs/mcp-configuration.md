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
