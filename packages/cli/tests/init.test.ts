import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANONICAL_RULES_FRAGMENT, rulesForTarget } from "../src/commands/init";

describe("rulesForTarget", () => {
  it("returns Codex rules", () => {
    expect(rulesForTarget("codex")).toContain("assess_delegation_need");
  });

  it("matches the Codex rules fragment", () => {
    const fragment = readFileSync(
      fileURLToPath(new URL("../../rules/codex/AGENTS.fragment.md", import.meta.url)),
      "utf8"
    );

    expect(fragment).toBe(CANONICAL_RULES_FRAGMENT);
    expect(rulesForTarget("codex")).toBe(`# Codex AGENTS.md Fragment\n\n${fragment}`);
  });

  it("matches the Claude Code rules fragment", () => {
    const fragment = readFileSync(
      fileURLToPath(new URL("../../rules/claude-code/CLAUDE.fragment.md", import.meta.url)),
      "utf8"
    );

    expect(fragment).toBe(CANONICAL_RULES_FRAGMENT);
    expect(rulesForTarget("claude-code")).toBe(`# Claude Code CLAUDE.md Fragment\n\n${fragment}`);
  });

  it("matches the generic rules fragment", () => {
    const fragment = readFileSync(
      fileURLToPath(new URL("../../rules/generic/agent-delegate-rules.md", import.meta.url)),
      "utf8"
    );

    expect(fragment).toBe(CANONICAL_RULES_FRAGMENT);
    expect(rulesForTarget("generic")).toBe(`# Generic Agent Rules\n\n${fragment}`);
  });

  it("rejects unknown targets", () => {
    expect(() => rulesForTarget("unknown")).toThrow("Unsupported init target");
  });
});
