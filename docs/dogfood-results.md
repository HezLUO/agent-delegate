# Dogfood Results

Use this file to record real MCP-enabled agent trials. Automated tests and `npm run smoke:mcp` are necessary but do not replace a real agent workflow.

## 2026-06-27 Codex Thread Trial

- Agent app: Codex desktop background thread
- Repository path: `/Users/james/Codex Project/General Codex Project/sub_ag_ski`
- Local verification before trial: passed
- MCP tools visible in the agent session: no
- MCP tools successfully called: none
- Verdict: failed dogfood trial

Findings:

- The local MCP server implementation and smoke path passed outside the real agent session.
- The real Codex session did not expose the project-owned MCP tools: `record_event`, `assess_delegation_need`, `generate_delegation_briefs`, `assess_brief_quality`, or `summarize_subagent_results`.
- This is most likely an agent-app MCP configuration issue, not proof that the MCP server implementation is broken.

Required follow-up:

- Run `npm run agent-delegate -- doctor` from this repository.
- Configure the agent app with the MCP configuration printed by `doctor`.
- Start a fresh agent session and confirm all five tools are visible before counting the trial as passed.

## 2026-06-27 Codex MCP Visibility Retest

- Agent app: Codex desktop background thread
- Repository path: `/Users/james/Codex Project/General Codex Project/sub_ag_ski`
- `npm run agent-delegate -- doctor`: pass
- MCP tools visible in the agent session: yes
- MCP tools successfully called: `record_event`, `assess_delegation_need`, `generate_delegation_briefs`, `assess_brief_quality`, `summarize_subagent_results`
- Real task: MCP visibility dogfood retest with a simulated long read-only investigation state
- Delegation recommendation observed: `dispatch_readonly` with high confidence
- Brief generation observed: yes, 2 read-only briefs
- Brief quality check observed: yes, first brief passed
- Summary observed: yes, summary returned high confidence
- Verdict: pass

Notes:

- The Codex global MCP configuration was updated with an `agent_delegate` stdio server entry pointing at this repository.
- The first `record_event` call failed because the supplied `timestamp` did not satisfy the tool schema. Retrying without `timestamp` succeeded.
- The successful retest used the real MCP tools exposed to a fresh Codex session, not shell substitutes.

## Template

- Date:
- Agent app:
- Repository path:
- `npm run agent-delegate -- doctor`: pass/fail
- MCP tools visible in the agent session: yes/no
- MCP tools successfully called:
- Real task:
- Delegation recommendation observed:
- Brief generation observed: yes/no
- Brief quality check observed: yes/no
- Summary observed: yes/no
- Verdict: pass/fail
- Notes:
