import { z } from "zod";
import {
  AgentStateSchema,
  BriefQualityInputSchema,
  BriefQualityResult,
  DelegationBrief
} from "./schema.js";

const GenerateBriefsInputSchema = AgentStateSchema.extend({
  current_phase: AgentStateSchema.shape.current_phase.default("investigation"),
  max_briefs: z.number().int().positive().max(3).default(3)
});

const DEFAULT_EXPECTED_OUTPUT = [
  "Status: done / blocked / needs_context",
  "Findings",
  "Evidence",
  "Relevant files/functions",
  "Open questions",
  "Recommended next step"
];

function filesForQuestion(question: string, files: Array<{ path: string; module?: string }>): string[] {
  const lower = question.toLowerCase();
  const matching = files.filter((file) => {
    const haystack = `${file.path} ${file.module ?? ""}`.toLowerCase();
    return lower
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4)
      .some((word) => haystack.includes(word));
  });
  return (matching.length > 0 ? matching : files).slice(0, 6).map((file) => file.path);
}

function titleForQuestion(question: string): string {
  const cleaned = question.replace(/[?!.]+$/g, "").trim();
  if (/^is |^are |^does |^do |^where |^why |^how /i.test(cleaned)) {
    return `Investigate ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }
  return `Investigate ${cleaned}`;
}

function impliesWriteAccess(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  if (/^do not edit files?$/.test(normalized)) {
    return false;
  }
  if (/^do not make changes?$/.test(normalized)) {
    return false;
  }
  if (/^stop if (write access|changes?) (is|are|would be) required$/.test(normalized)) {
    return false;
  }

  const writeVerb = "(add|apply|change|commit|create|delete|edit|fix|implement|land|modify|move|patch|refactor|remove|rename|replace|update|write)";
  const writeAction = "(adding|changing|committed|creating|deleting|editing|modifying|moving|patching|removing|renaming|replacing)";

  return new RegExp(`^(please )?${writeVerb}\\b`).test(normalized)
    || /\bmake (a )?(change|changes|patch)\b/.test(normalized)
    || new RegExp(`\\bshould (we|i|the agent|the subagent|the main agent) ${writeVerb}\\b`).test(normalized)
    || new RegExp(`\\b(after|once) ${writeAction}\\b`).test(normalized);
}

export function generateDelegationBriefs(input: unknown): {
  briefs: DelegationBrief[];
  reason?: string;
  suggested_next_step?: string;
} {
  const state = GenerateBriefsInputSchema.parse(input);
  const maxBriefs = Math.min(state.max_briefs, state.constraints.max_subagents);
  const questions = state.open_questions.slice(0, maxBriefs);

  if (questions.length === 0) {
    return {
      briefs: [],
      reason: "No open questions were provided, so no bounded read-only briefs can be generated.",
      suggested_next_step: "Continue with the main agent or summarize context before delegating."
    };
  }

  if (state.files_read.length === 0) {
    return {
      briefs: [],
      reason: "No scoped files were provided, so no bounded read-only briefs can be generated.",
      suggested_next_step: "Read or summarize relevant files before delegating."
    };
  }

  const briefs = questions.map((question) => {
    const scopedFiles = filesForQuestion(question, state.files_read);
    return {
      title: titleForQuestion(question),
      mode: "readonly" as const,
      goal: question,
      scope: {
        files: scopedFiles,
        exclude_files: []
      },
      context: state.context_summary ?? `Current task: ${state.task}`,
      questions: [question],
      expected_output: DEFAULT_EXPECTED_OUTPUT,
      budget: {
        max_files: Math.min(6, Math.max(1, scopedFiles.length || 3)),
        max_minutes: 10,
        max_tokens: 3000
      },
      stop_conditions: [
        "Do not edit files.",
        "Stop when the question can be answered with evidence.",
        "Stop and report needs_context if the required files are outside scope."
      ]
    };
  });

  return { briefs };
}

export function assessBriefQuality(input: unknown): BriefQualityResult {
  const { brief } = BriefQualityInputSchema.parse(input);
  const issues: string[] = [];

  if (/whole codebase|everything|all files|understand the codebase/i.test(brief.goal)) {
    issues.push("Goal is too broad.");
  }

  const scopedFileCount = brief.scope.files?.length ?? 0;
  const scopedModuleCount = brief.scope.modules?.length ?? 0;
  if (scopedFileCount === 0 && scopedModuleCount === 0) {
    issues.push("Scope must include at least one file or module.");
  }

  if (!brief.expected_output.some((item) => /evidence/i.test(item))) {
    issues.push("Expected output must require evidence.");
  }

  if (!brief.budget.max_files && !brief.budget.max_minutes && !brief.budget.max_tokens) {
    issues.push("Budget must include max_files, max_minutes, or max_tokens.");
  }

  if (brief.stop_conditions.length === 0) {
    issues.push("At least one stop condition is required.");
  }

  const impliesWrite = [
    brief.title,
    brief.goal,
    brief.context,
    ...brief.questions,
    ...brief.expected_output,
    ...brief.stop_conditions
  ].some(impliesWriteAccess);
  if (impliesWrite) {
    issues.push("Brief implies write access, which is out of scope for v1.");
  }

  if (issues.length === 0) {
    return {
      quality: "pass",
      issues: [],
      improved_brief: null
    };
  }

  const canSuggestImprovedBrief = scopedFileCount > 0 || scopedModuleCount > 0;

  const improvedBrief: DelegationBrief | null = canSuggestImprovedBrief && !impliesWrite ? {
    ...brief,
    mode: "readonly",
    goal: issues.includes("Goal is too broad.")
      ? "Answer the listed bounded investigation question using evidence from the scoped files."
      : brief.goal,
    scope: brief.scope,
    expected_output: brief.expected_output.some((item) => /evidence/i.test(item))
      ? brief.expected_output
      : [...brief.expected_output, "Evidence"],
    budget:
      !brief.budget.max_files && !brief.budget.max_minutes && !brief.budget.max_tokens
        ? { ...brief.budget, max_files: 5, max_minutes: 10 }
        : brief.budget,
    stop_conditions:
      brief.stop_conditions.length === 0
        ? ["Do not edit files.", "Stop when the question can be answered with evidence."]
        : brief.stop_conditions
  } : null;

  return {
    quality: "needs_revision",
    issues,
    improved_brief: improvedBrief
  };
}
