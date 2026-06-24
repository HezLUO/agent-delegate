import { describe, expect, it } from "vitest";
import { summarizeSubagentResults } from "../src/summary";

describe("summarizeSubagentResults", () => {
  it("compresses findings and evidence", () => {
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: "Fixtures create expired sessions.",
          evidence: ["tests/auth/fixtures.ts:18"],
          recommended_next_steps: ["Inspect fixture expiry setup."]
        }
      ],
      target_tokens: 800
    });

    expect(summary.summary).toContain("Fixtures create expired sessions.");
    expect(summary.confirmed_findings[0].evidence).toContain("tests/auth/fixtures.ts:18");
    expect(summary.files_to_revisit).toContain("tests/auth/fixtures.ts");
  });

  it("preserves blocked status as an open question", () => {
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate runtime session refresh",
          status: "blocked",
          summary: "Could not inspect generated session code.",
          evidence: [],
          open_questions: ["Where is generated session code stored?"]
        }
      ],
      target_tokens: 800
    });

    expect(summary.open_questions).toContain("Where is generated session code stored?");
    expect(summary.confidence).toBe("low");
  });

  it("only extracts local file paths from evidence", () => {
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: "Fixtures create expired sessions.",
          evidence: ["tests/auth/fixtures.ts:18", "src/auth/session.ts:10:2", "Error: timeout"]
        }
      ],
      target_tokens: 800
    });

    expect(summary.files_to_revisit).toEqual(["tests/auth/fixtures.ts", "src/auth/session.ts"]);
  });
});
