#!/usr/bin/env node

/**
 * @mrcp/cli — mrcp-autonomous.ts
 * Entrypoint autônomo do pacote CLI
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Executa o script master localizado na raiz bin
const masterScript = path.resolve(__dirname, "../../../bin/mrcp-autonomous.ts");
const { spawn } = await import("child_process");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", `"${masterScript}"`, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd(), shell: true },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
