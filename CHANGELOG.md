# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning once public releases begin.

## 0.1.0 - 2026-06-28

Initial GitHub pre-release for early MCP-enabled dogfooding.

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
- `doctor` command for local MCP setup checks and copyable MCP configuration output.
- Dogfood fixtures and MCP stdio smoke coverage.
- Dogfood fixture recommendation assertions for CI.
- Real MCP-enabled dogfood result records.
- Rules snippets for Codex, Claude Code, and generic agents.
