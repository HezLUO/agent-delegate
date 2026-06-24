# agent-delegate Rules

When investigation grows beyond a small local edit, call the `agent-delegate` MCP tool `assess_delegation_need`.

Trigger examples:
- You have read 8+ files without implementation.
- You have 2+ independent open questions.
- You are about to inspect another module after already inspecting two.
- You have multiple failing tests in different files.
- Your context summary is stale or too long.

Tool sequence:
1. Call `assess_delegation_need`.
2. If recommendation is `dispatch_readonly`, call `generate_delegation_briefs`.
3. Call `assess_brief_quality` before dispatching each brief.
4. After subagents return, call `summarize_subagent_results`.

Prefer read-only delegation. Do not request write-code subagents in v1.
