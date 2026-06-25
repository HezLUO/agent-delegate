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

  it("bounds oversized result summaries by target tokens", () => {
    const longSummary = Array.from({ length: 120 }, (_, index) => `word${index}`).join(" ");
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: longSummary,
          evidence: ["tests/auth/fixtures.ts:18"]
        }
      ],
      target_tokens: 40
    });

    expect(summary.summary.split(/\s+/).length).toBeLessThanOrEqual(31);
    expect(summary.summary).toMatch(/\.\.\.$/);
  });

  it("preserves conflict and disagreement strings", () => {
    const summary = summarizeSubagentResults({
      task: "Fix slow auth tests",
      results: [
        {
          brief_title: "Investigate fixture setup",
          status: "done",
          summary: "Conflict: fixtures point to expiry while runtime shows a different root cause.",
          evidence: ["tests/auth/fixtures.ts:18"],
          open_questions: ["This contradicts the middleware timing finding."]
        }
      ],
      target_tokens: 800
    });

    expect(summary.conflicts_or_disagreements).toEqual([
      "Investigate fixture setup: Conflict: fixtures point to expiry while runtime shows a different root cause.",
      "Investigate fixture setup: This contradicts the middleware timing finding."
    ]);
  });
});
