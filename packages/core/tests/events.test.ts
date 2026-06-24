import { describe, expect, it } from "vitest";
import { createInMemoryEventStore } from "../src/events";

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
});
