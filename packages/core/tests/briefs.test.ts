import { describe, expect, it } from "vitest";
import { assessBriefQuality, generateDelegationBriefs } from "../src/briefs";

describe("generateDelegationBriefs", () => {
  it("creates bounded readonly briefs from open questions", () => {
    const result = generateDelegationBriefs({
      task: "Fix slow auth tests",
      context_summary: "Auth tests are slow after session refactor.",
      files_read: [
        { path: "src/auth/session.ts", module: "auth" },
        { path: "tests/auth/fixtures.ts", module: "tests" }
      ],
      open_questions: [
        "Is runtime session refresh causing delay?",
        "Are fixtures creating expired sessions?"
      ],
      max_briefs: 2
    });

    expect(result.briefs).toHaveLength(2);
    expect(result.briefs[0].mode).toBe("readonly");
    expect(result.briefs[0].do_not_edit).toBeUndefined();
    expect(result.briefs[0].expected_output).toContain("Evidence");
  });

  it("returns no briefs when there are no bounded questions", () => {
    const result = generateDelegationBriefs({
      task: "Understand checkout",
      context_summary: "Need to understand checkout.",
      files_read: [{ path: "src/checkout/index.ts", module: "checkout" }],
      open_questions: [],
      max_briefs: 2
    });

    expect(result.briefs).toHaveLength(0);
    expect(result.reason).toContain("No open questions");
  });

  it("returns no briefs when questions have no scoped files", () => {
    const result = generateDelegationBriefs({
      task: "Investigate checkout behavior",
      context_summary: "Checkout behavior changed after refactor.",
      files_read: [],
      open_questions: ["Where is checkout total calculation handled?"],
      max_briefs: 2
    });

    expect(result.briefs).toHaveLength(0);
    expect(result.reason).toContain("No scoped files");
  });
});

describe("assessBriefQuality", () => {
  it("rejects broad briefs", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Understand everything",
        mode: "readonly",
        goal: "Understand the whole codebase",
        scope: {},
        context: "The main agent is confused.",
        questions: ["What is going on?"],
        expected_output: ["Summary"],
        budget: {},
        stop_conditions: ["Stop after reporting that the brief is too broad"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Goal is too broad.");
    expect(result.improved_brief).toBeNull();
  });

  it("accepts bounded readonly briefs", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate auth fixture setup",
        mode: "readonly",
        goal: "Determine whether auth fixtures create expired sessions.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Slow auth tests started after session refactor.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 3, max_minutes: 10 },
        stop_conditions: ["Stop after inspecting listed files", "Stop if write access is required"]
      }
    });

    expect(result.quality).toBe("pass");
  });

  it("accepts bounded readonly briefs asking what changed", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate checkout behavior change",
        mode: "readonly",
        goal: "Determine what changed in checkout behavior.",
        scope: { files: ["src/checkout/index.ts"] },
        context: "Checkout totals differ after refactor.",
        questions: ["What changed?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 2, max_minutes: 10 },
        stop_conditions: ["Do not edit files.", "Stop if write access is required"]
      }
    });

    expect(result.quality).toBe("pass");
  });

  it.each([
    { goal: "Determine checkout behavior.", question: "What should change?" },
    { goal: "Which behavior should change?", question: "Which behavior should change?" }
  ])("accepts readonly investigation wording $question", ({ goal, question }) => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate checkout behavior",
        mode: "readonly",
        goal,
        scope: { files: ["src/checkout/index.ts"] },
        context: "Checkout totals differ after refactor.",
        questions: [question],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 2, max_minutes: 10 },
        stop_conditions: ["Do not edit files.", "Stop if write access is required"]
      }
    });

    expect(result.quality).toBe("pass");
  });

  it("rejects scoped briefs with write instructions without suggesting an improved brief", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Patch auth fixture setup",
        mode: "readonly",
        goal: "Update the fixture file.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Auth fixtures create expired sessions.",
        questions: ["Should we patch the expired session setup?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 2, max_minutes: 10 },
        stop_conditions: ["Stop after inspecting listed files"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Brief implies write access, which is out of scope for v1.");
    expect(result.improved_brief).toBeNull();
  });

  it("rejects direct change instructions without suggesting an improved brief", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Change auth fixture setup",
        mode: "readonly",
        goal: "Change the fixture file.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Auth fixtures create expired sessions.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 2, max_minutes: 10 },
        stop_conditions: ["Stop after inspecting listed files"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Brief implies write access, which is out of scope for v1.");
    expect(result.improved_brief).toBeNull();
  });

  it.each([
    "Remove the fixture file.",
    "Add a test helper.",
    "Rename the fixture file.",
    "Replace the auth middleware.",
    "Move the session helper."
  ])("rejects direct write goal %s", (goal) => {
    const result = assessBriefQuality({
      brief: {
        title: "Reject write directive",
        mode: "readonly",
        goal,
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Auth fixtures create expired sessions.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 2, max_minutes: 10 },
        stop_conditions: ["Stop after inspecting listed files"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Brief implies write access, which is out of scope for v1.");
    expect(result.improved_brief).toBeNull();
  });

  it("rejects write instructions in stop conditions", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate auth fixture setup",
        mode: "readonly",
        goal: "Determine whether auth fixtures create expired sessions.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Slow auth tests started after session refactor.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 3, max_minutes: 10 },
        stop_conditions: ["Commit the fix"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Brief implies write access, which is out of scope for v1.");
  });

  it("rejects write completion wording in stop conditions", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate auth fixture setup",
        mode: "readonly",
        goal: "Determine whether auth fixtures create expired sessions.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Slow auth tests started after session refactor.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 3, max_minutes: 10 },
        stop_conditions: ["Stop after editing tests"]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Brief implies write access, which is out of scope for v1.");
  });

  it.each([
    "Stop after removing the fixture file"
  ])("rejects write completion stop condition %s", (stopCondition) => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate auth fixture setup",
        mode: "readonly",
        goal: "Determine whether auth fixtures create expired sessions.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Slow auth tests started after session refactor.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 3, max_minutes: 10 },
        stop_conditions: [stopCondition]
      }
    });

    expect(result.quality).toBe("needs_revision");
    expect(result.issues).toContain("Brief implies write access, which is out of scope for v1.");
  });

  it("accepts equivalent readonly stop phrases", () => {
    const result = assessBriefQuality({
      brief: {
        title: "Investigate auth fixture setup",
        mode: "readonly",
        goal: "Determine whether auth fixtures create expired sessions.",
        scope: { files: ["tests/auth/fixtures.ts"] },
        context: "Slow auth tests started after session refactor.",
        questions: ["Where is fixture session expiry set?"],
        expected_output: ["Findings", "Evidence", "Recommended next step"],
        budget: { max_files: 3, max_minutes: 10 },
        stop_conditions: [
          "Do not edit files.",
          "Do not make changes.",
          "Stop if write access is required.",
          "Stop if changes would be required."
        ]
      }
    });

    expect(result.quality).toBe("pass");
  });
});
