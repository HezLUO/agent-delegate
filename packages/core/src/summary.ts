import {
  SubagentResultInputSchema,
  SubagentResultSummary,
  SubagentResultSchema
} from "./schema.js";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

const LOCAL_FILE_EVIDENCE_PATTERN = /^((?:\.{1,2}\/)?(?:[^:\s/]+\/)*[^:\s/]+\.[A-Za-z0-9]+)(?::\d+)?(?::\d+)?$/;

function evidenceToFile(evidence: string): string | undefined {
  return LOCAL_FILE_EVIDENCE_PATTERN.exec(evidence)?.[1];
}

const CONFLICT_PATTERN = /\b(conflict|disagree|disagreement|contradiction|contradict|contradicts|inconsistent|mismatch|different root cause)\b/i;

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text;
  }

  return `${words.slice(0, Math.max(1, maxWords - 1)).join(" ")} ...`;
}

export function summarizeSubagentResults(input: unknown): SubagentResultSummary {
  const parsed = SubagentResultInputSchema.parse(input);
  const results = parsed.results.map((result) => SubagentResultSchema.parse(result));
  const confirmed = results.filter((result) => result.status === "done");
  const blocked = results.filter((result) => result.status !== "done");
  const allEvidence = unique(results.flatMap((result) => result.evidence));
  const filesToRevisit = unique(allEvidence.map(evidenceToFile).filter((file): file is string => Boolean(file)));
  const openQuestions = unique([
    ...results.flatMap((result) => result.open_questions),
    ...blocked.map((result) => `${result.brief_title}: ${result.summary}`)
  ]);
  const nextSteps = unique(results.flatMap((result) => result.recommended_next_steps));

  const summaryParts = results.map((result) => `${result.brief_title}: ${result.summary}`);
  const maxSummaryWords = Math.max(1, Math.floor(parsed.target_tokens * 0.75));
  const summary = truncateWords(summaryParts.join(" "), maxSummaryWords);
  const conflicts = unique(
    results.flatMap((result) =>
      [result.summary, ...result.open_questions]
        .filter((text) => CONFLICT_PATTERN.test(text))
        .map((text) => `${result.brief_title}: ${text}`)
    )
  );

  return {
    summary,
    confirmed_findings: confirmed.map((result) => ({
      summary: result.summary,
      evidence: result.evidence
    })),
    conflicts_or_disagreements: conflicts,
    open_questions: openQuestions,
    recommended_next_steps: nextSteps,
    files_to_revisit: filesToRevisit,
    confidence: blocked.length > 0 ? "low" : confirmed.length === results.length ? "high" : "medium"
  };
}
