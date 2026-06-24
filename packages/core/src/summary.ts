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
  const summary = summaryParts.join(" ");

  return {
    summary,
    confirmed_findings: confirmed.map((result) => ({
      summary: result.summary,
      evidence: result.evidence
    })),
    conflicts_or_disagreements: [],
    open_questions: openQuestions,
    recommended_next_steps: nextSteps,
    files_to_revisit: filesToRevisit,
    confidence: blocked.length > 0 ? "low" : confirmed.length === results.length ? "high" : "medium"
  };
}
