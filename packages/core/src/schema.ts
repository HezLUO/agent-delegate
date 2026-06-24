import { z } from "zod";

export const CurrentPhaseSchema = z.enum([
  "planning",
  "investigation",
  "implementation",
  "debugging",
  "review",
  "verification"
]);

export const RecommendationSchema = z.enum([
  "continue_main_agent",
  "summarize_context",
  "dispatch_readonly",
  "ask_human"
]);

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const FileObservationSchema = z.object({
  path: z.string().min(1),
  summary: z.string().optional(),
  module: z.string().optional(),
  tokens_estimate: z.number().int().nonnegative().optional()
});

export const CommandObservationSchema = z.object({
  command: z.string().min(1),
  summary: z.string().optional(),
  status: z.enum(["passed", "failed", "unknown"]).default("unknown"),
  tokens_estimate: z.number().int().nonnegative().optional()
});

export const FindingSchema = z.object({
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([])
});

export const DelegationConstraintsSchema = z.object({
  max_subagents: z.number().int().positive().max(3).default(3),
  allow_write_agents: z.literal(false).default(false)
});

export const AgentStateSchema = z.object({
  task: z.string().min(1),
  current_phase: CurrentPhaseSchema,
  context_summary: z.string().optional(),
  files_read: z.array(FileObservationSchema).default([]),
  commands_run: z.array(CommandObservationSchema).default([]),
  files_written: z.array(z.string().min(1)).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  findings: z.array(FindingSchema).default([]),
  constraints: DelegationConstraintsSchema.default({
    max_subagents: 3,
    allow_write_agents: false
  }),
  metrics: z
    .object({
      turns_without_write: z.number().int().nonnegative().optional(),
      investigation_minutes: z.number().nonnegative().optional(),
      tool_output_tokens_estimate: z.number().int().nonnegative().optional(),
      same_question_repeated: z.number().int().nonnegative().optional(),
      tests_failures_in_independent_files: z.number().int().nonnegative().optional()
    })
    .default({})
});

export const GuardrailHitSchema = z.object({
  name: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  detail: z.string().min(1)
});

export const DelegationAssessmentSchema = z.object({
  recommendation: RecommendationSchema,
  confidence: ConfidenceSchema,
  scores: z.record(z.number()),
  reasons: z.array(z.string().min(1)),
  guardrails: z.array(GuardrailHitSchema),
  suggested_next_step: z.string().min(1),
  suggested_brief_count: z.number().int().positive().max(3).optional()
});

export const DelegationBriefSchema = z.object({
  title: z.string().min(1),
  mode: z.literal("readonly"),
  goal: z.string().min(1),
  scope: z.object({
    files: z.array(z.string().min(1)).optional(),
    modules: z.array(z.string().min(1)).optional(),
    exclude_files: z.array(z.string().min(1)).optional()
  }),
  context: z.string().min(1),
  questions: z.array(z.string().min(1)).min(1),
  expected_output: z.array(z.string().min(1)).min(1),
  budget: z.object({
    max_files: z.number().int().positive().optional(),
    max_minutes: z.number().positive().optional(),
    max_tokens: z.number().int().positive().optional()
  }),
  stop_conditions: z.array(z.string().min(1)).min(1)
});

export const BriefQualityInputSchema = z.object({
  brief: DelegationBriefSchema
});

export const BriefQualityResultSchema = z.object({
  quality: z.enum(["pass", "needs_revision"]),
  issues: z.array(z.string()),
  improved_brief: DelegationBriefSchema.nullable()
});

export const SubagentResultSchema = z.object({
  brief_title: z.string().min(1),
  status: z.enum(["done", "blocked", "needs_context"]),
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  recommended_next_steps: z.array(z.string().min(1)).default([])
});

export const SubagentResultInputSchema = z.object({
  task: z.string().min(1),
  results: z.array(SubagentResultSchema).min(1),
  target_tokens: z.number().int().positive().default(800)
});

export const SubagentResultSummarySchema = z.object({
  summary: z.string().min(1),
  confirmed_findings: z.array(FindingSchema),
  conflicts_or_disagreements: z.array(z.string()),
  open_questions: z.array(z.string()),
  recommended_next_steps: z.array(z.string()),
  files_to_revisit: z.array(z.string()),
  confidence: ConfidenceSchema
});

export const AgentEventSchema = z.object({
  type: z.enum([
    "task_started",
    "file_read",
    "command_run",
    "test_run",
    "file_written",
    "error_seen",
    "question_identified",
    "plan_created",
    "delegation_decision"
  ]),
  timestamp: z.string().datetime().optional(),
  summary: z.string().optional(),
  path: z.string().optional(),
  command: z.string().optional(),
  status: z.string().optional(),
  tokens_estimate: z.number().int().nonnegative().optional()
});

export const RecordEventInputSchema = z.object({
  session_id: z.string().min(1).optional(),
  event: AgentEventSchema
});

export type AgentState = z.infer<typeof AgentStateSchema>;
export type DelegationAssessment = z.infer<typeof DelegationAssessmentSchema>;
export type DelegationBrief = z.infer<typeof DelegationBriefSchema>;
export type BriefQualityResult = z.infer<typeof BriefQualityResultSchema>;
export type SubagentResultInput = z.infer<typeof SubagentResultInputSchema>;
export type SubagentResultSummary = z.infer<typeof SubagentResultSummarySchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type RecordEventInput = z.infer<typeof RecordEventInputSchema>;
