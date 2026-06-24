import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { formatExpectedError, isDirectEntrypoint, main, parseCommand } from "../src/index";

function captureStderr() {
  let stderr = "";

  return {
    io: {
      stderr: {
        write(chunk: string) {
          stderr += chunk;
        }
      }
    },
    stderr: () => stderr
  };
}

describe("parseCommand", () => {
  it("accepts serve without arguments", () => {
    expect(parseCommand(["serve"])).toEqual({ command: "serve" });
  });

  it("accepts analyze with one path", () => {
    expect(parseCommand(["analyze", "agent-state.json"])).toEqual({
      command: "analyze",
      path: "agent-state.json"
    });
  });

  it("accepts init with one target", () => {
    expect(parseCommand(["init", "codex"])).toEqual({ command: "init", target: "codex" });
  });

  it("rejects missing analyze arguments", () => {
    expect(parseCommand(["analyze"])).toBeNull();
  });

  it("rejects missing init arguments", () => {
    expect(parseCommand(["init"])).toBeNull();
  });

  it("rejects unknown commands", () => {
    expect(parseCommand(["unknown"])).toBeNull();
  });

  it("rejects extra serve arguments", () => {
    expect(parseCommand(["serve", "anything"])).toBeNull();
  });

  it("rejects extra analyze arguments", () => {
    expect(parseCommand(["analyze", "agent-state.json", "extra"])).toBeNull();
  });

  it("rejects extra init arguments", () => {
    expect(parseCommand(["init", "codex", "extra"])).toBeNull();
  });
});

describe("isDirectEntrypoint", () => {
  it("matches when invoked through a symlinked entrypoint path", () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-delegate-cli-"));
    const targetPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    const linkPath = join(directory, "agent-delegate");

    try {
      symlinkSync(targetPath, linkPath);
      expect(isDirectEntrypoint(pathToFileURL(targetPath).href, linkPath)).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("does not match when argv path is missing", () => {
    expect(isDirectEntrypoint(import.meta.url, undefined)).toBe(false);
  });
});

describe("formatExpectedError", () => {
  it("formats unsupported init target errors without a stack trace", () => {
    expect(formatExpectedError(new Error("Unsupported init target: foo"))).toContain(
      "Unsupported init target: foo"
    );
  });

  it("formats missing analyze file errors without a stack trace", () => {
    const error = Object.assign(new Error("missing"), {
      code: "ENOENT",
      path: "missing.json"
    });

    expect(formatExpectedError(error)).toBe("Could not read agent state file: missing.json");
  });

  it("formats invalid JSON errors without a stack trace", () => {
    expect(formatExpectedError(new SyntaxError("Unexpected token"))).toBe(
      "Invalid agent state JSON: Unexpected token"
    );
  });
});

describe("main", () => {
  it("prints a concise unsupported init target error", async () => {
    const captured = captureStderr();

    await expect(main(["init", "foo"], captured.io)).resolves.toBe(1);
    expect(captured.stderr()).toContain("Unsupported init target: foo");
    expect(captured.stderr()).toContain("Expected init target: codex, claude-code, or generic.");
    expect(captured.stderr()).not.toContain("\n    at ");
  });

  it("prints a concise missing analyze file error", async () => {
    const captured = captureStderr();

    await expect(main(["analyze", "missing-agent-state.json"], captured.io)).resolves.toBe(1);
    expect(captured.stderr()).toContain(
      "Could not read agent state file: missing-agent-state.json"
    );
    expect(captured.stderr()).not.toContain("\n    at ");
  });

  it("prints a concise bad JSON error", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-delegate-json-"));
    const path = join(directory, "agent-state.json");
    const captured = captureStderr();

    try {
      writeFileSync(path, "{", "utf8");
      await expect(main(["analyze", path], captured.io)).resolves.toBe(1);
      expect(captured.stderr()).toContain("Invalid agent state JSON:");
      expect(captured.stderr()).not.toContain("\n    at ");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
