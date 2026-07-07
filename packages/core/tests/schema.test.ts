import { describe, expect, it } from "vitest";
import {
  AgentStateSchema,
  DelegationBriefSchema,
  RecordEventInputSchema,
  SubagentResultInputSchema
} from "../src/schema";

describe("schema", () => {
  it("accepts a minimal agent state", () => {
    const parsed = AgentStateSchema.parse({
      task: "Fix slow auth tests",
      current_phase: "investigation"
    });

    expect(parsed.task).toBe("Fix slow auth tests");
    expect(parsed.current_phase).toBe("investigation");
  });

  it("rejects write-mode delegation briefs in v1", () => {
    expect(() =>
      DelegationBriefSchema.parse({
        title: "Patch auth tests",
        mode: "write",
        goal: "Change the tests",
        scope: { files: ["tests/auth/session.test.ts"] },
        context: "The tests are slow.",
        questions: ["What should change?"],
        expected_output: ["Patch"],
        budget: { max_files: 2 },
        stop_conditions: ["Stop after editing tests"]
      })
    ).toThrow();
  });

  it("accepts readonly subagent result inputs", () => {
    const parsed = SubagentResultInputSchema.parse({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: "Fixture setup creates expired sessions.",
          evidence: ["tests/auth/fixtures.ts:18"]
        }
      ],
      target_tokens: 800
    });

    expect(parsed.results[0].status).toBe("done");
  });

  it("explains how to recover from invalid event timestamps", () => {
    const parsed = RecordEventInputSchema.safeParse({
      event: {
        type: "file_read",
        timestamp: "June 27 2026",
        path: "src/auth/session.ts"
      }
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected timestamp validation to fail");
    }
    expect(parsed.error.issues[0].message).toMatch(
      /timestamp must be ISO 8601 with timezone, or omit timestamp/
    );
  });
});
