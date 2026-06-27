#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeCommand } from "./commands/analyze.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { serveCommand } from "./commands/serve.js";

const USAGE =
  "Usage: agent-delegate <serve | doctor | analyze <agent-state.json> | init <codex|claude-code|generic>>";

type ParsedCommand =
  | { command: "serve" }
  | { command: "doctor" }
  | { command: "analyze"; path: string }
  | { command: "init"; target: string };

type Writable = {
  write(chunk: string): unknown;
};

type CliIO = {
  stderr: Writable;
  stdout?: Writable;
};

export function parseCommand(argv: string[]): ParsedCommand | null {
  const [command, arg] = argv;

  if (command === "serve" && argv.length === 1) {
    return { command: "serve" };
  }

  if (command === "doctor" && argv.length === 1) {
    return { command: "doctor" };
  }

  if (command === "analyze" && arg && argv.length === 2) {
    return { command: "analyze", path: arg };
  }

  if (command === "init" && arg && argv.length === 2) {
    return { command: "init", target: arg };
  }

  return null;
}

export function isDirectEntrypoint(entryUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(entryUrl)) === realpathSync(resolve(argvPath));
  } catch {
    return false;
  }
}

export function formatExpectedError(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith("Unsupported init target: ")) {
    return `${error.message}\nExpected init target: codex, claude-code, or generic.`;
  }

  if (error instanceof SyntaxError) {
    return `Invalid agent state JSON: ${error.message}`;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT" &&
    "path" in error
  ) {
    return `Could not read agent state file: ${String(error.path)}`;
  }

  if (error instanceof Error && error.name === "ZodError") {
    return "Invalid agent state: schema validation failed.";
  }

  return null;
}

export async function main(
  argv: string[],
  io: CliIO = { stderr: process.stderr }
): Promise<number> {
  const parsed = parseCommand(argv);

  try {
    if (parsed?.command === "serve") {
      await serveCommand();
      return 0;
    }

    if (parsed?.command === "analyze") {
      analyzeCommand(parsed.path);
      return 0;
    }

    if (parsed?.command === "doctor") {
      return await doctorCommand({ stdout: io.stdout ?? process.stdout });
    }

    if (parsed?.command === "init") {
      initCommand(parsed.target);
      return 0;
    }
  } catch (error) {
    const message = formatExpectedError(error);
    if (message) {
      io.stderr.write(`${message}\n${USAGE}\n`);
      return 1;
    }

    throw error;
  }

  io.stderr.write(`${USAGE}\n`);
  return 1;
}

if (isDirectEntrypoint(import.meta.url, process.argv[1])) {
  main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
