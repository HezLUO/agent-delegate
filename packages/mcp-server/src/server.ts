import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AgentStateSchema,
  AgentState,
  BriefQualityInputSchema,
  RecordEventInputSchema,
  SubagentResultInputSchema,
  assessBriefQuality,
  assessDelegationNeed,
  createInMemoryEventStore,
  eventSessionToAgentState,
  generateDelegationBriefs,
  summarizeSubagentResults
} from "@agent-delegate/core";

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

const AssessDelegationNeedToolInputSchema = AgentStateSchema.partial({
  task: true,
  current_phase: true
}).extend({
  session_id: z.string().min(1).optional()
});

const AssessDelegationNeedRuntimeSchema = AssessDelegationNeedToolInputSchema.superRefine(
  (value, context) => {
    if (!value.session_id && (!value.task || !value.current_phase)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assess_delegation_need requires either session_id or task and current_phase"
      });
    }
  }
);

function nonEmptyString(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function inputObject(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? input as Record<string, unknown> : {};
}

function hasOwnInputField(input: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, field);
}

export function parseAssessDelegationNeedInput(
  input: unknown
): z.infer<typeof AssessDelegationNeedToolInputSchema> {
  return AssessDelegationNeedRuntimeSchema.parse(input);
}

export function mergeExplicitStateWithSession(
  input: unknown,
  eventStore: ReturnType<typeof createInMemoryEventStore>
): AgentState {
  const rawInput = inputObject(input);
  const parsed = parseAssessDelegationNeedInput(input);
  const sessionState = parsed.session_id
    ? eventSessionToAgentState(eventStore.get(parsed.session_id))
    : {};

  return AgentStateSchema.parse({
    task: hasOwnInputField(rawInput, "task") && nonEmptyString(parsed.task)
      ? parsed.task
      : sessionState.task ?? "Recorded session analysis",
    current_phase: hasOwnInputField(rawInput, "current_phase")
      ? parsed.current_phase
      : "investigation",
    context_summary: hasOwnInputField(rawInput, "context_summary")
      ? parsed.context_summary
      : sessionState.context_summary,
    files_read:
      hasOwnInputField(rawInput, "files_read")
        ? parsed.files_read
        : sessionState.files_read ?? [],
    commands_run:
      hasOwnInputField(rawInput, "commands_run")
        ? parsed.commands_run
        : sessionState.commands_run ?? [],
    files_written:
      hasOwnInputField(rawInput, "files_written")
        ? parsed.files_written
        : sessionState.files_written ?? [],
    open_questions:
      hasOwnInputField(rawInput, "open_questions")
        ? parsed.open_questions
        : sessionState.open_questions ?? [],
    findings:
      hasOwnInputField(rawInput, "findings")
        ? parsed.findings
        : sessionState.findings ?? [],
    constraints: parsed.constraints,
    metrics: parsed.metrics
  });
}

export function createAgentDelegateServer(): McpServer {
  const server = new McpServer({
    name: "agent-delegate",
    version: "0.1.0"
  });
  const eventStore = createInMemoryEventStore();

  server.registerTool(
    "record_event",
    {
      description: "Record a lightweight local session event for delegation analysis.",
      inputSchema: RecordEventInputSchema.shape
    },
    (input) => jsonContent(eventStore.record(input))
  );

  server.registerTool(
    "assess_delegation_need",
    {
      description: "Assess whether main agent should continue, summarize, dispatch read-only subagents, or ask user.",
      inputSchema: AssessDelegationNeedToolInputSchema.shape
    },
    (input) => jsonContent(assessDelegationNeed(mergeExplicitStateWithSession(input, eventStore)))
  );

  server.registerTool(
    "generate_delegation_briefs",
    {
      description: "Generate bounded read-only subagent briefs from current agent state.",
      inputSchema: AgentStateSchema.extend({
        max_briefs: z.number().int().positive().max(3).default(3)
      }).shape
    },
    (input) => jsonContent(generateDelegationBriefs(input))
  );

  server.registerTool(
    "assess_brief_quality",
    {
      description: "Check whether read-only delegation brief is specific and safe enough to dispatch.",
      inputSchema: BriefQualityInputSchema.shape
    },
    (input) => jsonContent(assessBriefQuality(input))
  );

  server.registerTool(
    "summarize_subagent_results",
    {
      description: "Compress subagent results into compact main-agent context.",
      inputSchema: SubagentResultInputSchema.shape
    },
    (input) => jsonContent(summarizeSubagentResults(input))
  );

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createAgentDelegateServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
