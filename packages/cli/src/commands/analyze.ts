import { readFileSync } from "node:fs";
import { assessDelegationNeed } from "@agent-delegate/core";

export function analyzeAgentStateJson(json: string): string {
  const parsed = JSON.parse(json);
  return JSON.stringify(assessDelegationNeed(parsed), null, 2);
}

export function analyzeCommand(path: string): void {
  const json = readFileSync(path, "utf8");
  process.stdout.write(`${analyzeAgentStateJson(json)}\n`);
}
