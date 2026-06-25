import { describe, expect, it } from "vitest";
import { assessDelegationNeed } from "../src/policy";

describe("assessDelegationNeed", () => {
  it("continues for a small local task with a clear next edit", () => {
    const assessment = assessDelegationNeed({
      task: "Rename typo in auth error message",
      current_phase: "investigation",
      context_summary: "Found the typo in one file.",
      files_read: [{ path: "src/auth/errors.ts", module: "auth" }],
      findings: [{ summary: "One obvious edit is needed.", evidence: ["src/auth/errors.ts"] }],
      open_questions: [],
      files_written: [],
      metrics: { turns_without_write: 1 }
    });

    expect(assessment.recommendation).toBe("continue_main_agent");
    expect(assessment.confidence).toBe("high");
  });

  it("dispatches readonly when investigation spans many files and questions", () => {
    const assessment = assessDelegationNeed({
      task: "Fix slow auth tests",
      current_phase: "investigation",
      context_summary: "Read auth runtime, middleware, fixtures, and test helpers.",
      files_read: [
        { path: "src/auth/session.ts", module: "auth" },
        { path: "src/auth/middleware.ts", module: "auth" },
        { path: "src/auth/token.ts", module: "auth" },
        { path: "tests/auth/session.test.ts", module: "tests" },
        { path: "tests/auth/fixtures.ts", module: "tests" },
        { path: "tests/helpers/time.ts", module: "tests" },
        { path: "src/config/auth.ts", module: "config" },
        { path: "src/http/cookies.ts", module: "http" }
      ],
      open_questions: [
        "Is token refresh timing responsible?",
        "Are fixtures creating expired sessions?"
      ],
      metrics: {
        turns_without_write: 4,
        investigation_minutes: 14,
        tool_output_tokens_estimate: 9000
      }
    });

    expect(assessment.recommendation).toBe("dispatch_readonly");
    expect(assessment.suggested_brief_count).toBe(2);
    expect(assessment.reasons.length).toBeGreaterThan(0);
  });

  it("respects constraints max_subagents in suggested brief count", () => {
    const assessment = assessDelegationNeed({
      task: "Fix slow auth tests",
      current_phase: "investigation",
      context_summary: "Read auth runtime, middleware, fixtures, and test helpers.",
      files_read: [
        { path: "src/auth/session.ts", module: "auth" },
        { path: "src/auth/middleware.ts", module: "auth" },
        { path: "src/auth/token.ts", module: "auth" },
        { path: "tests/auth/session.test.ts", module: "tests" },
        { path: "tests/auth/fixtures.ts", module: "tests" },
        { path: "tests/helpers/time.ts", module: "tests" },
        { path: "src/config/auth.ts", module: "config" },
        { path: "src/http/cookies.ts", module: "http" }
      ],
      open_questions: [
        "Is token refresh timing responsible?",
        "Are fixtures creating expired sessions?"
      ],
      constraints: { max_subagents: 1, allow_write_agents: false },
      metrics: {
        turns_without_write: 4,
        investigation_minutes: 14,
        tool_output_tokens_estimate: 9000
      }
    });

    expect(assessment.recommendation).toBe("dispatch_readonly");
    expect(assessment.suggested_brief_count).toBe(1);
  });

  it("prefers summarizing context over a low-confidence near-tie dispatch", () => {
    const assessment = assessDelegationNeed({
      task: "Investigate checkout mismatch",
      current_phase: "investigation",
      context_summary: "Thin notes.",
      files_read: [
        { path: "src/checkout/totals.ts", module: "checkout" },
        { path: "src/checkout/discounts.ts", module: "checkout" },
        { path: "src/cart/totals.ts", module: "cart" }
      ],
      open_questions: ["Why does the total differ?", "Does cart rounding differ?"]
    });

    expect(assessment.scores.dispatch_readonly).toBeGreaterThan(assessment.scores.summarize_context);
    expect(assessment.confidence).toBe("low");
    expect(assessment.recommendation).toBe("summarize_context");
  });

  it("summarizes context when investigation is large but split is unclear", () => {
    const assessment = assessDelegationNeed({
      task: "Understand why checkout behavior changed",
      current_phase: "investigation",
      context_summary: "Many findings are scattered and no plan exists.",
      files_read: Array.from({ length: 12 }, (_, index) => ({
        path: `src/checkout/file-${index}.ts`,
        module: "checkout"
      })),
      open_questions: ["What changed?"],
      metrics: {
        turns_without_write: 5,
        tool_output_tokens_estimate: 14000
      }
    });

    expect(assessment.recommendation).toBe("summarize_context");
  });

  it("asks the human when the goal is ambiguous", () => {
    const assessment = assessDelegationNeed({
      task: "Make it better",
      current_phase: "planning",
      context_summary: "",
      files_read: [],
      open_questions: []
    });

    expect(assessment.recommendation).toBe("ask_human");
  });

  it("asks the human for ambiguous goals even with strong dispatch signals", () => {
    const assessment = assessDelegationNeed({
      task: "Fix it",
      current_phase: "investigation",
      context_summary: "Read many files and still do not have a specific user goal.",
      files_read: Array.from({ length: 10 }, (_, index) => ({
        path: `src/module-${index}/file.ts`,
        module: `module-${index}`
      })),
      open_questions: [
        "Which behavior should change?",
        "What output is currently wrong?",
        "What outcome does the user expect?"
      ],
      metrics: {
        turns_without_write: 6,
        investigation_minutes: 20,
        tool_output_tokens_estimate: 16000,
        tests_failures_in_independent_files: 3
      }
    });

    expect(assessment.recommendation).toBe("ask_human");
    expect(assessment.confidence).toBe("low");
  });

  it("uses repeated question loops as a transparent dispatch signal", () => {
    const assessment = assessDelegationNeed({
      task: "Find why account tests are flaky",
      current_phase: "investigation",
      context_summary: "The same timing question keeps coming up across account files.",
      files_read: [
        { path: "src/account/session.ts", module: "account" },
        { path: "src/account/clock.ts", module: "account" },
        { path: "tests/account/session.test.ts", module: "tests" },
        { path: "tests/helpers/time.ts", module: "test-helpers" }
      ],
      open_questions: ["Why does the timing assertion drift?"],
      metrics: {
        same_question_repeated: 2
      }
    });

    expect(assessment.recommendation).toBe("dispatch_readonly");
    expect(assessment.scores.dispatch_readonly).toBeGreaterThan(assessment.scores.continue_main_agent);
    expect(assessment.reasons).toContain("The same question has repeated 2 times.");
  });
});
