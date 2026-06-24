import {
  AgentState,
  AgentStateSchema,
  DelegationAssessment,
  GuardrailHitSchema
} from "./schema.js";

type ScoreName =
  | "continue_main_agent"
  | "summarize_context"
  | "dispatch_readonly"
  | "ask_human";

const AMBIGUOUS_TASK_PATTERNS = [
  /^make it better$/i,
  /^fix it$/i,
  /^improve this$/i,
  /^clean this up$/i
];

function moduleCount(state: AgentState): number {
  const modules = new Set(
    state.files_read.map((file) => file.module ?? file.path.split("/").slice(0, 2).join("/"))
  );
  return modules.size;
}

function hasClearNextEdit(state: AgentState): boolean {
  return state.findings.some((finding) => /obvious edit|single edit|one .* edit/i.test(finding.summary));
}

function ambiguousGoal(task: string): boolean {
  return AMBIGUOUS_TASK_PATTERNS.some((pattern) => pattern.test(task.trim()));
}

function confidenceFor(best: number, second: number, highSeverityGuardrails: number): "low" | "medium" | "high" {
  if (best - second >= 4 && highSeverityGuardrails === 0) {
    return "high";
  }
  if (best - second >= 2) {
    return "medium";
  }
  return "low";
}

export function assessDelegationNeed(input: unknown): DelegationAssessment {
  const state = AgentStateSchema.parse(input);
  const scores: Record<ScoreName, number> = {
    continue_main_agent: 0,
    summarize_context: 0,
    dispatch_readonly: 0,
    ask_human: 0
  };
  const reasons: string[] = [];
  const guardrails: Array<ReturnType<typeof GuardrailHitSchema.parse>> = [];

  const filesRead = state.files_read.length;
  const modulesTouched = moduleCount(state);
  const openQuestions = state.open_questions.length;
  const turnsWithoutWrite = state.metrics.turns_without_write ?? 0;
  const investigationMinutes = state.metrics.investigation_minutes ?? 0;
  const toolOutputTokens = state.metrics.tool_output_tokens_estimate ?? 0;
  const independentFailures = state.metrics.tests_failures_in_independent_files ?? 0;
  const sameQuestionRepeated = state.metrics.same_question_repeated ?? 0;
  const isAmbiguousGoal = ambiguousGoal(state.task);

  if (isAmbiguousGoal) {
    scores.ask_human += 8;
    reasons.push("The task goal is too ambiguous to delegate safely.");
  }

  if (filesRead <= 3) {
    scores.continue_main_agent += 3;
    reasons.push("The investigation is still small.");
  }

  if (modulesTouched <= 1 && filesRead > 0) {
    scores.continue_main_agent += 2;
    guardrails.push({
      name: "single_module_scope",
      severity: "medium",
      detail: "The likely root cause appears concentrated in one module."
    });
  }

  if (hasClearNextEdit(state)) {
    scores.continue_main_agent += 5;
    reasons.push("There is one obvious next edit.");
  }

  if (state.files_written.length > 0) {
    scores.continue_main_agent += 2;
    reasons.push("Implementation has already started.");
  }

  if (filesRead >= 8) {
    scores.dispatch_readonly += 3;
    reasons.push(`The agent has read ${filesRead} files.`);
  }

  if (turnsWithoutWrite >= 3) {
    scores.dispatch_readonly += 2;
    reasons.push(`There have been ${turnsWithoutWrite} turns without a file write.`);
  }

  if (investigationMinutes >= 10) {
    scores.dispatch_readonly += 2;
    reasons.push(`Investigation has lasted about ${investigationMinutes} minutes.`);
  }

  if (openQuestions >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push("There are multiple open questions that may be separable.");
  }

  if (modulesTouched >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push(`The investigation spans ${modulesTouched} modules.`);
  }

  if (toolOutputTokens >= 6000) {
    scores.dispatch_readonly += 1;
    reasons.push("Tool output is large enough to create context pressure.");
  }

  if (independentFailures >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push("There are failing tests in multiple independent files.");
  }

  if (sameQuestionRepeated >= 2) {
    scores.dispatch_readonly += 2;
    reasons.push(`The same question has repeated ${sameQuestionRepeated} times.`);
  }

  if (!state.context_summary || state.context_summary.trim().length < 20) {
    scores.summarize_context += 3;
    reasons.push("The context summary is missing or too thin.");
  }

  if (toolOutputTokens >= 10000) {
    scores.summarize_context += 5;
    reasons.push("Tool output is very large and should be summarized.");
  }

  if (state.findings.length >= 3 && openQuestions === 0) {
    scores.summarize_context += 2;
    reasons.push("There are many findings but no explicit next plan.");
  }

  if (modulesTouched <= 1 && filesRead >= 8) {
    scores.dispatch_readonly -= 4;
    scores.summarize_context += 3;
  }

  if (openQuestions === 0 && filesRead >= 8) {
    scores.dispatch_readonly -= 2;
    scores.summarize_context += 2;
    guardrails.push({
      name: "unclear_delegation_question",
      severity: "medium",
      detail: "The agent has not identified bounded questions for subagents."
    });
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<[ScoreName, number]>;
  const [bestName, bestScore] = ranked[0];
  const secondScore = ranked[1][1];
  const recommendation = isAmbiguousGoal
    ? "ask_human"
    : bestScore <= 0 ? "continue_main_agent" : bestName === "dispatch_readonly" && guardrails.some((g) => g.severity === "high") ? "summarize_context" : bestName;

  const confidence = isAmbiguousGoal
    ? "low"
    : confidenceFor(
        bestScore,
        secondScore,
        guardrails.filter((guardrail) => guardrail.severity === "high").length
      );
  const suggestedBriefCount =
    recommendation === "dispatch_readonly" ? Math.min(3, Math.max(1, openQuestions)) : undefined;

  const suggestedNextStepByRecommendation: Record<ScoreName, string> = {
    continue_main_agent: "Continue in the main agent and make the next focused edit.",
    summarize_context: "Summarize current findings before reading more files.",
    dispatch_readonly: `Generate ${suggestedBriefCount ?? 1} read-only delegation brief(s) with non-overlapping scope.`,
    ask_human: "Ask the user to clarify the goal before continuing."
  };

  return {
    recommendation,
    confidence,
    scores,
    reasons: reasons.length > 0 ? reasons : ["No delegation trigger was detected."],
    guardrails,
    suggested_next_step: suggestedNextStepByRecommendation[recommendation],
    suggested_brief_count: suggestedBriefCount
  };
}
