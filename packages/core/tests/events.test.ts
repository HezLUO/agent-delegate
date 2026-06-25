import { describe, expect, it } from "vitest";
import { createInMemoryEventStore, eventSessionToAgentState } from "../src/events";

describe("event store", () => {
  it("records safe events in a generated session", () => {
    const store = createInMemoryEventStore();
    const result = store.record({
      event: {
        type: "file_read",
        path: "src/auth/session.ts",
        summary: "Session validation logic"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.session_id).toMatch(/^session-/);
    expect(store.get(result.session_id).events).toHaveLength(1);
  });

  it("rejects secret-like summaries", () => {
    const store = createInMemoryEventStore();
    const result = store.record({
      event: {
        type: "error_seen",
        summary: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("event_rejected");
  });

  it.each([
    {
      summary: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
      label: "bearer authorization header"
    },
    {
      summary: "Authorization Bearer abcdefghijklmnopqrstuvwxyz123456",
      label: "bearer authorization text without colon"
    },
    {
      summary: "Run cli --token abcdefghijklmnopqrstuvwxyz123456",
      label: "cli token flag"
    },
    {
      summary: "Run cli --token \"abcdefghijklmnopqrstuvwxyz123456\"",
      label: "quoted cli token flag"
    }
  ])("rejects secret-like $label", ({ summary }) => {
    const store = createInMemoryEventStore();
    const result = store.record({
      event: {
        type: "command_run",
        command: "example",
        summary
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("event_rejected");
  });

  it("returns defensive copies of stored sessions", () => {
    const store = createInMemoryEventStore();
    const result = store.record({
      event: {
        type: "file_read",
        path: "src/auth/session.ts",
        summary: "Session validation logic"
      }
    });

    if (!result.ok) {
      throw new Error("Expected event to record successfully");
    }

    const session = store.get(result.session_id);
    session.events.push({
      type: "error_seen",
      summary: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz"
    });
    session.events[0].summary = "Mutated summary";

    const stored = store.get(result.session_id);
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      type: "file_read",
      path: "src/auth/session.ts",
      summary: "Session validation logic"
    });
  });

  it("derives agent observations from recorded session events", () => {
    const derived = eventSessionToAgentState({
      session_id: "session-1",
      events: [
        { type: "task_started", summary: "Fix slow auth tests" },
        {
          type: "file_read",
          path: "src/auth/session.ts",
          summary: "Session validation logic",
          tokens_estimate: 1200
        },
        {
          type: "command_run",
          command: "npm test auth",
          status: "failed",
          summary: "Auth tests timed out",
          tokens_estimate: 900
        },
        { type: "file_written", path: "src/auth/session.ts" },
        { type: "question_identified", summary: "Is refresh timing responsible?" },
        { type: "error_seen", summary: "Timeout while refreshing token" },
        { type: "plan_created", summary: "Compare fixture and runtime expiry paths" },
        { type: "delegation_decision", summary: "Readonly split considered" }
      ]
    });

    expect(derived.task).toBe("Fix slow auth tests");
    expect(derived.context_summary).toContain("Fix slow auth tests");
    expect(derived.files_read).toEqual([
      {
        path: "src/auth/session.ts",
        summary: "Session validation logic",
        tokens_estimate: 1200
      }
    ]);
    expect(derived.commands_run).toEqual([
      {
        command: "npm test auth",
        status: "failed",
        summary: "Auth tests timed out",
        tokens_estimate: 900
      }
    ]);
    expect(derived.files_written).toEqual(["src/auth/session.ts"]);
    expect(derived.open_questions).toEqual(["Is refresh timing responsible?"]);
    expect(derived.findings.map((finding) => finding.summary)).toEqual([
      "Timeout while refreshing token",
      "Compare fixture and runtime expiry paths",
      "Readonly split considered"
    ]);
  });
});
