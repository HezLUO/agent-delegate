import { runStdioServer } from "@agent-delegate/mcp-server";

export async function serveCommand(): Promise<void> {
  await runStdioServer();
}
