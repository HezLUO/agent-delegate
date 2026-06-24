#!/usr/bin/env node
export * from "./server.js";

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runStdioServer } from "./server.js";

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runStdioServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
