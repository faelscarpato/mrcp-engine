#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

// Se o usuário passar uma URL direto, roda no modo CLI (Análise standalone)
if (args.length === 1 && args[0].startsWith('http')) {
  const repoUrl = args[0];
  console.log(`[MRCP-Engine] Iniciando análise stand-alone para: ${repoUrl}\n`);
  
  // Usamos o tsx (ou node se compilado) para rodar a pipeline
  const pipelinePath = path.resolve(__dirname, '../../core/lib/analysis/pipeline.js');
  
  import(pipelinePath).then(async ({ runAnalysis }) => {
    try {
      const result = await runAnalysis({
        repoUrl: repoUrl,
        githubToken: process.env.GITHUB_TOKEN,
        maxFiles: 2000,
      });
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (e) {
      console.error('Erro na análise:', e.message);
      process.exit(1);
    }
  }).catch(e => {
    console.error('Erro ao carregar o motor MRCP:', e.message);
    console.log('Dica: Execute via tsx localmente ou faça o build do projeto primeiro.');
    process.exit(1);
  });
} else {
  // Modo Servidor MCP (Usado por IAs e IDEs)
  const mcpServerPath = path.resolve(__dirname, '../mcp-server.mjs');

  const child = spawn('npx', ['tsx', mcpServerPath, ...args], {
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error(`Failed to start MRCP-Engine CLI: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
