import { describe, expect, it } from "vitest";
import { createInMemoryEventStore } from "@agent-delegate/core";
import { mergeExplicitStateWithSession, parseAssessDelegationNeedInput } from "../src/server";

describe("MCP assessment state merging", () => {
  it("rejects stateless inputs missing task and current_phase", () => {
    const store = createInMemoryEventStore();

    expect(() => mergeExplicitStateWithSession({}, store)).toThrow();
    expect(() =>
      parseAssessDelegationNeedInput({ files_read: [] })
    ).toThrow(/requires either session_id or task and current_phase/);
  });

  it("uses recorded session observations when session_id is provided", () => {
    const store = createInMemoryEventStore();
    const started = store.record({
      event: { type: "task_started", summary: "Fix slow auth tests" }
    });

    if (!started.ok) {
      throw new Error("Expected task event to record successfully");
    }

    store.record({
      session_id: started.session_id,
      event: {
        type: "file_read",
        path: "src/auth/session.ts",
        summary: "Session validation logic"
      }
    });
    store.record({
      session_id: started.session_id,
      event: {
        type: "question_identified",
        summary: "Is refresh timing responsible?"
      }
    });

    const merged = mergeExplicitStateWithSession(
      {
        session_id: started.session_id
      },
      store
    );

    expect(merged.task).toBe("Fix slow auth tests");
    expect(merged.current_phase).toBe("investigation");
    expect(merged.files_read).toEqual([
      { path: "src/auth/session.ts", summary: "Session validation logic" }
    ]);
    expect(merged.open_questions).toEqual(["Is refresh timing responsible?"]);
  });

  it("accepts session_id-only input after recorded task and file events", () => {
    const store = createInMemoryEventStore();
    const started = store.record({
      event: { type: "task_started", summary: "Fix slow auth tests" }
    });

    if (!started.ok) {
      throw new Error("Expected task event to record successfully");
    }

    store.record({
      session_id: started.session_id,
      event: {
        type: "file_read",
        path: "src/auth/session.ts",
        summary: "Session validation logic"
      }
    });

    const merged = mergeExplicitStateWithSession({ session_id: started.session_id }, store);

    expect(merged.task).toBe("Fix slow auth tests");
    expect(merged.current_phase).toBe("investigation");
    expect(merged.files_read).toEqual([
      { path: "src/auth/session.ts", summary: "Session validation logic" }
    ]);
  });

  it("does not override explicit non-empty observations with session events", () => {
    const store = createInMemoryEventStore();
    const started = store.record({
      event: { type: "task_started", summary: "Recorded task" }
    });

    if (!started.ok) {
      throw new Error("Expected task event to record successfully");
    }

    store.record({
      session_id: started.session_id,
      event: {
        type: "file_read",
        path: "src/auth/session.ts",
        summary: "Recorded session file"
      }
    });

    const merged = mergeExplicitStateWithSession(
      {
        session_id: started.session_id,
        task: "Explicit task",
        current_phase: "review",
        files_read: [{ path: "src/auth/explicit.ts", summary: "Explicit file" }]
      },
      store
    );

    expect(merged.task).toBe("Explicit task");
    expect(merged.current_phase).toBe("review");
    expect(merged.files_read).toEqual([
      { path: "src/auth/explicit.ts", summary: "Explicit file" }
    ]);
  });

  it("respects explicit empty arrays over recorded session observations", () => {
    const store = createInMemoryEventStore();
    const started = store.record({
      event: { type: "task_started", summary: "Recorded task" }
    });

    if (!started.ok) {
      throw new Error("Expected task event to record successfully");
    }

    store.record({
      session_id: started.session_id,
      event: {
        type: "question_identified",
        summary: "Is refresh timing responsible?"
      }
    });

    const merged = mergeExplicitStateWithSession(
      {
        session_id: started.session_id,
        open_questions: []
      },
      store
    );

    expect(merged.open_questions).toEqual([]);
  });
});
