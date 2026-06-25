import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isDirectEntrypoint } from "../src/index";

describe("MCP entrypoint", () => {
  it("matches when invoked through a symlinked entrypoint path", () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-delegate-mcp-"));
    const targetPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    const linkPath = join(directory, "agent-delegate-mcp");

    try {
      symlinkSync(targetPath, linkPath);
      expect(isDirectEntrypoint(pathToFileURL(targetPath).href, linkPath)).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
