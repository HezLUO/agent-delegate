import { describe, expect, it } from "vitest";
import { analyzeAgentStateJson } from "../src/commands/analyze";

describe("analyzeAgentStateJson", () => {
  it("returns a delegation assessment JSON string", () => {
    const output = analyzeAgentStateJson(
      JSON.stringify({
        task: "Fix slow auth tests",
        current_phase: "investigation",
        context_summary: "Read auth runtime and tests.",
        files_read: Array.from({ length: 8 }, (_, index) => ({
          path: `file-${index}.ts`,
          module: index < 4 ? "auth" : "tests"
        })),
        open_questions: ["Is runtime slow?", "Are fixtures invalid?"],
        metrics: { turns_without_write: 4 }
      })
    );

    expect(JSON.parse(output).recommendation).toBe("dispatch_readonly");
  });
});
