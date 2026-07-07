# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning once public releases begin.

## Unreleased

### Fixed

- `record_event` now accepts ISO 8601 timestamps with timezone offsets, such as
  `2026-06-27T20:47:12+08:00`, and reports a recovery-oriented validation message for invalid timestamps.

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
