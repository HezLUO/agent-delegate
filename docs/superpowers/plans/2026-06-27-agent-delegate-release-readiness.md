# agent-delegate Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `agent-delegate` for an initial public GitHub release after dogfooding has passed, without publishing to npm or creating the remote repository yet.

**Architecture:** Add standard open-source project metadata, CI, release documentation, and stronger first-run instructions. Keep the product behavior unchanged: this phase is documentation, metadata, and verification infrastructure only.

**Tech Stack:** Markdown, GitHub Actions, Node.js 24, npm, TypeScript, Vitest.

---

## File Structure

Create or modify these files:

```text
LICENSE
CONTRIBUTING.md
CHANGELOG.md
SECURITY.md
README.md
package.json
.github/
  workflows/
    ci.yml
  ISSUE_TEMPLATE/
    bug_report.md
    feature_request.md
docs/
  release-checklist.md
  mcp-configuration.md
```

Responsibilities:

- `LICENSE`: project license for public use.
- `CONTRIBUTING.md`: local development and contribution expectations.
- `CHANGELOG.md`: initial unreleased changelog.
- `SECURITY.md`: vulnerability reporting expectations without promising a private program before one exists.
- `.github/workflows/ci.yml`: public CI verification for tests, typecheck, build, MCP smoke, and fixture checks.
- Issue templates: structured bug and feature reports.
- `docs/release-checklist.md`: pre-release checklist.
- `docs/mcp-configuration.md`: copyable MCP configuration examples.
- `README.md`: public-facing setup, status, dogfood, and MCP usage entrypoint.

## Task 1: Add Open Source Metadata

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `SECURITY.md`
- Modify: `package.json`

- [ ] **Step 1: Add MIT license**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 James

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Add contributing guide**

Create `CONTRIBUTING.md`:

```md
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
```

- [ ] **Step 3: Add changelog**

Create `CHANGELOG.md`:

```md
# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning once public releases begin.

## Unreleased

### Added

- v1 read-only delegation advisor core.
- MCP tools:
  - `record_event`
  - `assess_delegation_need`
  - `generate_delegation_briefs`
  - `assess_brief_quality`
  - `summarize_subagent_results`
- CLI commands:
  - `serve`
  - `analyze`
  - `init`
- Dogfood fixtures and MCP stdio smoke coverage.
- Rules snippets for Codex, Claude Code, and generic agents.
```

- [ ] **Step 4: Add security policy**

Create `SECURITY.md`:

```md
# Security Policy

`agent-delegate` is local-first and should not store source file contents or complete command output by default.

## Reporting Security Issues

Before a public repository and private advisory process exist, do not file sensitive vulnerabilities in public issues.

For now, report suspected security issues directly to the project maintainer through a private channel.

## Scope

Security-sensitive areas include:

- Secret-like content detection and rejection.
- MCP stdio behavior.
- Local session event storage.
- Generated brief content that might accidentally request write access in v1.

## Supported Versions

No public release has been published yet. Security support begins with the first public release.
```

- [ ] **Step 5: Update root package metadata**

Modify `package.json` to add public metadata while preserving existing scripts, dependencies, and workspaces:

```json
{
  "name": "agent-delegate-repo",
  "private": true,
  "version": "0.1.0",
  "description": "MCP-first delegation advisor for coding agents.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/agent-delegate/agent-delegate.git"
  },
  "bugs": {
    "url": "https://github.com/agent-delegate/agent-delegate/issues"
  },
  "homepage": "https://github.com/agent-delegate/agent-delegate#readme",
  "keywords": [
    "mcp",
    "coding-agents",
    "subagents",
    "delegation",
    "agent-tools"
  ]
}
```

Keep `private: true` for now. This plan prepares GitHub release readiness, not npm publication.

- [ ] **Step 6: Verify metadata files exist**

Run:

```bash
test -f LICENSE
test -f CONTRIBUTING.md
test -f CHANGELOG.md
test -f SECURITY.md
npm test
```

Expected: all `test -f` commands exit successfully and `npm test` passes.

- [ ] **Step 7: Commit metadata**

Run:

```bash
git add LICENSE CONTRIBUTING.md CHANGELOG.md SECURITY.md package.json
git commit -m "docs: add open source project metadata"
```

## Task 2: Add CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add GitHub Actions workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  contents: read

jobs:
  test:
    name: Test on Node ${{ matrix.node }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node:
          - 22
          - 24

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: MCP smoke
        run: npm run smoke:mcp

      - name: Dogfood long investigation fixture
        run: npm run agent-delegate -- analyze examples/dogfood-long-investigation.json

      - name: Dogfood small edit fixture
        run: npm run agent-delegate -- analyze examples/dogfood-small-edit.json

      - name: Dogfood ambiguous goal fixture
        run: npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Rationale: `actions/checkout@v7` and `actions/setup-node@v6` match current official action README examples as of 2026-06-27. `setup-node` examples recommend explicitly specifying Node version, so the matrix uses Node 22 and 24.

- [ ] **Step 2: Check workflow syntax shape locally**

Run:

```bash
test -f .github/workflows/ci.yml
rg -n "actions/checkout@v7|actions/setup-node@v6|npm run smoke:mcp|dogfood-long-investigation" .github/workflows/ci.yml
```

Expected: `test -f` passes and `rg` prints matching workflow lines.

- [ ] **Step 3: Run local verification equivalent**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run smoke:mcp
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Expected: all commands pass. Fixture recommendations are `dispatch_readonly`, `continue_main_agent`, and `ask_human`.

- [ ] **Step 4: Commit CI**

Run:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add release readiness workflow"
```

## Task 3: Add Release and MCP Configuration Docs

**Files:**
- Create: `docs/release-checklist.md`
- Create: `docs/mcp-configuration.md`
- Modify: `README.md`

- [ ] **Step 1: Add release checklist**

Create `docs/release-checklist.md`:

```md
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
```

- [ ] **Step 2: Add MCP configuration guide**

Create `docs/mcp-configuration.md`:

```md
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
```

- [ ] **Step 3: Update README with docs links**

Modify `README.md` to add a `Documentation` section after `MCP Tools`:

```md
## Documentation

- [Dogfood protocol](docs/dogfood.md)
- [MCP configuration](docs/mcp-configuration.md)
- [Release checklist](docs/release-checklist.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
```

- [ ] **Step 4: Verify docs links and smoke**

Run:

```bash
test -f docs/release-checklist.md
test -f docs/mcp-configuration.md
rg -n "MCP configuration|Release checklist|Contributing" README.md
npm run smoke:mcp
```

Expected: docs exist, README links are present, and MCP smoke passes.

- [ ] **Step 5: Commit docs**

Run:

```bash
git add README.md docs/release-checklist.md docs/mcp-configuration.md
git commit -m "docs: add release and MCP configuration guides"
```

## Task 4: Add Issue Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`

- [ ] **Step 1: Add bug report template**

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```md
---
name: Bug report
about: Report a reproducible problem with agent-delegate
title: "[Bug]: "
labels: bug
assignees: ""
---

## Summary

Describe the bug in one or two sentences.

## Reproduction

Steps to reproduce:

1. Run `npm run --silent agent-delegate -- serve`.
2. Call `assess_delegation_need` with the agent state shown below.
3. Observe the unexpected recommendation or error.

## Expected Behavior

What should have happened?

## Actual Behavior

What happened instead?

## Environment

- Node version:
- npm version:
- Operating system:
- Agent tool:

## Logs or Output

Paste relevant output. Do not include secrets.

## Scope Check

- [ ] This is about v1 read-only delegation behavior.
- [ ] I am not requesting write-code subagent execution.
```

- [ ] **Step 2: Add feature request template**

Create `.github/ISSUE_TEMPLATE/feature_request.md`:

```md
---
name: Feature request
about: Suggest an improvement to agent-delegate
title: "[Feature]: "
labels: enhancement
assignees: ""
---

## Problem

What problem should this solve?

## Proposed Behavior

Describe the behavior you want.

## Example Workflow

Show how an agent or user would use it.

## Version Scope

- [ ] v1 read-only delegation advisor
- [ ] Future write-readiness assessment
- [ ] Future write-code subagent support

## Alternatives Considered

What workaround are you using today?
```

- [ ] **Step 3: Verify templates exist**

Run:

```bash
test -f .github/ISSUE_TEMPLATE/bug_report.md
test -f .github/ISSUE_TEMPLATE/feature_request.md
rg -n "write-code subagent|read-only delegation|Feature request" .github/ISSUE_TEMPLATE
```

Expected: all files exist and `rg` prints relevant lines.

- [ ] **Step 4: Commit issue templates**

Run:

```bash
git add .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md
git commit -m "docs: add issue templates"
```

## Task 5: Final Release Readiness Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run smoke:mcp
npm run agent-delegate -- analyze examples/dogfood-long-investigation.json
npm run agent-delegate -- analyze examples/dogfood-small-edit.json
npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json
```

Expected: all commands pass. Fixture recommendations are `dispatch_readonly`, `continue_main_agent`, and `ask_human`.

- [ ] **Step 2: Check release files**

Run:

```bash
test -f LICENSE
test -f CONTRIBUTING.md
test -f CHANGELOG.md
test -f SECURITY.md
test -f .github/workflows/ci.yml
test -f docs/release-checklist.md
test -f docs/mcp-configuration.md
```

Expected: all files exist.

- [ ] **Step 3: Inspect git state**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: `git status --short` is empty and recent commits include release readiness work.

## Execution Notes

This plan prepares the repository for public GitHub release. It does not create a remote GitHub repository, push code, publish to npm, or change the product behavior.

The local Codex sandbox may require escalation for commands that use `tsx` IPC or stdio MCP smoke. If `npm test`, `npm run smoke:mcp`, `npm run agent-delegate -- analyze examples/dogfood-long-investigation.json`, `npm run agent-delegate -- analyze examples/dogfood-small-edit.json`, or `npm run agent-delegate -- analyze examples/dogfood-ambiguous-goal.json` fails with an IPC `EPERM`, rerun the same command with escalation and record that in the final report.
