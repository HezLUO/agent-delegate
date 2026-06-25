#!/usr/bin/env node
export * from "./server.js";

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runStdioServer } from "./server.js";

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

if (isDirectEntrypoint(import.meta.url, process.argv[1])) {
  runStdioServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
