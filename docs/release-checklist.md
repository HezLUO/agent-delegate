# Release Checklist

Use this checklist before making `agent-delegate` public.

## Local Verification

Run:

```bash
npm test
npm run typecheck
npm run build
npm run agent-delegate -- doctor
npm run smoke:mcp
npm run check:fixtures
npm pack --dry-run --workspace @agent-delegate/core
npm pack --dry-run --workspace @agent-delegate/mcp-server
npm pack --dry-run --workspace agent-delegate
npm publish --dry-run --workspace @agent-delegate/core --access public
npm publish --dry-run --workspace @agent-delegate/mcp-server --access public
npm publish --dry-run --workspace agent-delegate --access public
```

Inspect dogfood fixtures manually if needed:

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
- `docs/dogfood-results.md` records the latest real agent trial.
- `npm pack --dry-run` shows only intended package artifacts.
- npm package versions match the git release tag that will be published.

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

## npm Publish Order

Publish workspace dependencies before dependents:

```bash
npm publish --workspace @agent-delegate/core --access public
npm publish --workspace @agent-delegate/mcp-server --access public
npm publish --workspace agent-delegate --access public
```
