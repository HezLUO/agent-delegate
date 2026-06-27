# Release Checklist

Use this checklist before making `agent-delegate` public.

## Local Verification

Run:

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

- Long investigation: `dispatch_readonly`
- Small edit: `continue_main_agent`
- Ambiguous goal: `ask_human`

## Repository Readiness

- `README.md` explains what v1 does and does not do.
- `LICENSE` exists.
- `CONTRIBUTING.md` exists.
- `SECURITY.md` exists.
- `CHANGELOG.md` has an `Unreleased` section.
- CI workflow exists and passes.
- Dogfood protocol has been run in at least one real MCP-enabled agent workflow.

## Release Boundaries

The first public release must not claim:

- Write-code subagent execution.
- Automatic background monitoring.
- Automatic dispatch.
- Worktree orchestration.
- Hosted service support.

## After GitHub Repository Creation

- Confirm repository URL in `package.json`.
- Confirm issue templates render correctly.
- Confirm CI passes on GitHub-hosted runners.
- Add a release tag only after CI passes.
