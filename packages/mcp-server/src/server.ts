import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AgentStateSchema,
  BriefQualityInputSchema,
  RecordEventInputSchema,
  SubagentResultInputSchema,
  assessBriefQuality,
  assessDelegationNeed,
  createInMemoryEventStore,
  generateDelegationBriefs,
  summarizeSubagentResults
} from "@agent-delegate/core";

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
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
      inputSchema: AgentStateSchema.shape
    },
    (input) => jsonContent(assessDelegationNeed(input))
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
