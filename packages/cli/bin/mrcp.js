#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = process.argv.slice(2);

// Se o usuário passar uma URL direto, roda no modo CLI (Análise standalone)
if (args.length === 1 && args[0].startsWith('http')) {
  const runScriptPath = path.resolve(__dirname, '../run-standalone.ts');
  const child = spawn('npx', ['tsx', runScriptPath, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('error', (err) => {
    console.error(`Failed to start MRCP-Engine: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else {
  // Modo Servidor MCP (Usado por IAs e IDEs)
  const mcpServerPath = path.resolve(__dirname, '../mcp-server.mjs');
  const child = spawn('npx', ['tsx', mcpServerPath, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('error', (err) => {
    console.error(`Failed to start MRCP-Engine CLI: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
