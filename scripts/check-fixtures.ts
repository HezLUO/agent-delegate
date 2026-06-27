import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeAgentStateJson } from "../packages/cli/src/commands/analyze.js";

const FIXTURES = [
  {
    path: "examples/dogfood-long-investigation.json",
    expectedRecommendation: "dispatch_readonly"
  },
  {
    path: "examples/dogfood-small-edit.json",
    expectedRecommendation: "continue_main_agent"
  },
  {
    path: "examples/dogfood-ambiguous-goal.json",
    expectedRecommendation: "ask_human"
  }
];

type AnalyzeOutput = {
  recommendation?: string;
};

for (const fixture of FIXTURES) {
  const fullPath = join(process.cwd(), fixture.path);
  const output = JSON.parse(analyzeAgentStateJson(readFileSync(fullPath, "utf8"))) as AnalyzeOutput;

  if (output.recommendation !== fixture.expectedRecommendation) {
    throw new Error(
      `${fixture.path} expected ${fixture.expectedRecommendation}, got ${output.recommendation ?? "missing recommendation"}`
    );
  }

  console.log(`${fixture.path}: ${output.recommendation}`);
}

console.log("Dogfood fixture recommendations passed");
