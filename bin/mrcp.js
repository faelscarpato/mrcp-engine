#!/usr/bin/env node

/**
 * MRCP-Engine CLI & MCP Server
 * 
 * Modos de uso:
 *   npx mrcp-engine setup          → Configura IDEs e abre o Terminal Control Panel Interativo
 *   npx mrcp-engine <repo-url>     → Executa diagnóstico via CLI e salva relatórios
 *   npx mrcp-engine                → Se executado em terminal interativo: abre Control Panel
 *                                    Se executado via IDE/Processo (stdio): inicia Servidor MCP
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startInteractiveDashboard } from './interactive-ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MRCP_API_BASE = process.env.MRCP_API_URL || 'https://mrcp-engine.vercel.app';
const CACHE_FILE = 'mrcp-analysis.json';

const args = process.argv.slice(2);

// ─────────────────────────────────────────────
//  Função de Configuração de IDEs
// ─────────────────────────────────────────────
function runIdeSetup() {
  console.log('\n🔧 [MRCP-Engine] Auto-configuração de MCP nas IDEs e Plataformas\n');

  const home = process.env.HOME || process.env.USERPROFILE || '';
  const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
  
  const httpEntry = { url: `${MRCP_API_BASE}/api/mcp` };
  const antigravityEntry = { serverUrl: `${MRCP_API_BASE}/api/mcp` };
  const stdioEntry = { command: "npx", args: ["-y", "mrcp-engine"] };

  const ideConfigs = [
    {
      name: 'Claude Desktop',
      paths: [
        join(appData, 'Claude', 'claude_desktop_config.json'),
        join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        join(home, '.config', 'claude', 'claude_desktop_config.json'),
      ],
      key: 'mcpServers',
      entry: httpEntry,
      type: 'json'
    },
    {
      name: 'Cursor',
      paths: [join(home, '.cursor', 'mcp.json')],
      key: 'mcpServers',
      entry: httpEntry,
      type: 'json'
    },
    {
      name: 'Windsurf',
      paths: [join(home, '.codeium', 'windsurf', 'mcp_config.json')],
      key: 'mcpServers',
      entry: httpEntry,
      type: 'json'
    },
    {
      name: 'VSCode',
      paths: [
        join(appData, 'Code', 'User', 'mcp.json'),
        join(home, '.config', 'Code', 'User', 'mcp.json'),
        join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
      ],
      key: 'mcpServers',
      entry: stdioEntry,
      type: 'json'
    },
    {
      name: 'Antigravity IDE',
      paths: [join(home, '.gemini', 'config', 'mcp_config.json')],
      key: 'mcpServers',
      entry: antigravityEntry,
      type: 'json'
    },
    {
      name: 'Gemini CLI',
      paths: [join(home, '.gemini', 'settings.json')],
      key: 'mcpServers',
      entry: stdioEntry,
      type: 'json'
    },
    {
      name: 'Claude Code',
      paths: [join(home, '.claude.json')],
      key: 'mcpServers',
      entry: stdioEntry,
      type: 'json'
    },
    {
      name: 'OpenCode',
      paths: [join(home, '.opencode', 'mcp.json')],
      key: 'mcpServers',
      entry: stdioEntry,
      type: 'json'
    },
    {
      name: 'Ollama (MCP)',
      paths: [join(home, '.ollama', 'mcp.json')],
      key: 'mcpServers',
      entry: stdioEntry,
      type: 'json'
    },
    {
      name: 'Codex',
      paths: [join(home, '.codex', 'config.toml')],
      type: 'toml'
    }
  ];

  let configured = 0;

  for (const ide of ideConfigs) {
    let configuredForIde = false;

    for (const configPath of ide.paths) {
      if (configuredForIde) break;

      try {
        const configDir = dirname(configPath);
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
        }

        if (ide.type === 'json') {
          let config = {};
          if (existsSync(configPath)) {
            config = JSON.parse(readFileSync(configPath, 'utf-8'));
          }

          if (!config[ide.key]) config[ide.key] = {};

          if (config[ide.key]['mrcp-engine']) {
            console.log(`   ✅ ${ide.name} — Já estava configurado`);
            configured++;
            configuredForIde = true;
            break;
          }

          config[ide.key]['mrcp-engine'] = ide.entry;
          writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
          console.log(`   ✅ ${ide.name} — Configurado com sucesso!`);
          configured++;
          configuredForIde = true;
        } 
        else if (ide.type === 'toml') {
          let content = '';
          if (existsSync(configPath)) {
            content = readFileSync(configPath, 'utf-8');
          }

          if (content.includes('[mcp_servers.mrcp-engine]')) {
            console.log(`   ✅ ${ide.name} — Já estava configurado`);
            configured++;
            configuredForIde = true;
            break;
          }

          const tomlEntry = `\n[mcp_servers.mrcp-engine]\ncommand = "npx"\nargs = ["-y", "mrcp-engine"]\n`;
          writeFileSync(configPath, content + tomlEntry, 'utf-8');
          console.log(`   ✅ ${ide.name} — Configurado com sucesso!`);
          configured++;
          configuredForIde = true;
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (configured === 0) {
    console.log('   ℹ️  IDEs verificadas.');
  } else {
    console.log(`\n   🎉 ${configured} integração(ões) pronta(s) para os Agentes de IA!`);
  }
}

// ─────────────────────────────────────────────
//  Roteamento Principal
// ─────────────────────────────────────────────

// 1. Modo Setup / UI Interativo
if (args[0] === 'setup' || args[0] === 'ui') {
  runIdeSetup();
  console.log('\nIniciando painel interativo de desenvolvimento em 1s...');
  setTimeout(() => {
    startInteractiveDashboard();
  }, 1000);
}

// 2. Modo Análise Direta via CLI
else if (args.length >= 1 && (args[0].startsWith('http') || args[0] === 'full-suite' || args[0] === 'security' || args[0] === 'health')) {
  let targetEndpoint = 'full-suite';
  let repoUrl = '';

  if (args[0].startsWith('http')) {
    repoUrl = args[0];
  } else {
    targetEndpoint = args[0] === 'security' ? 'security-audit' : args[0] === 'health' ? 'code-health' : args[0];
    repoUrl = args[1] || '';
  }

  if (!repoUrl) {
    console.error('❌ Erro: URL do repositório é obrigatória.');
    console.error('   Exemplo: npx mrcp-engine https://github.com/user/repo');
    process.exit(1);
  }

  const noSave = args.includes('--no-save');

  console.log(`\n🔍 [MRCP-Engine] Analisando: ${repoUrl}`);
  console.log(`   Endpoint: /api/${targetEndpoint}`);
  console.log(`   Delegando processamento para ${MRCP_API_BASE}...\n`);

  try {
    const apiUrl = `${MRCP_API_BASE}/api/${targetEndpoint}?repo=${encodeURIComponent(repoUrl)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Erro da API (HTTP ${response.status}): ${errorBody}`);
      process.exit(1);
    }

    const data = await response.json();

    let markdownContent = '';
    try {
      const mdRes = await fetch(`${apiUrl}&format=markdown`);
      if (mdRes.ok) markdownContent = await mdRes.text();
    } catch {}

    if (!noSave) {
      const reportsDir = join(process.cwd(), 'reports');
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }

      const outJsonRoot = join(process.cwd(), CACHE_FILE);
      const outJsonReports = join(reportsDir, CACHE_FILE);
      const jsonFormatted = JSON.stringify(data, null, 2);

      writeFileSync(outJsonRoot, jsonFormatted, 'utf-8');
      writeFileSync(outJsonReports, jsonFormatted, 'utf-8');

      if (markdownContent) {
        const outMdRoot = join(process.cwd(), 'MRCP_EXECUTIVE_REPORT.md');
        const outMdReports = join(reportsDir, `MRCP_${targetEndpoint.toUpperCase().replace(/-/g, '_')}.md`);
        writeFileSync(outMdRoot, markdownContent, 'utf-8');
        writeFileSync(outMdReports, markdownContent, 'utf-8');
      }

      console.log(`\n✅ Relatórios gerados e salvos com sucesso:`);
      console.log(`   📄 JSON:     ${outJsonRoot}`);
      console.log(`   📝 Markdown: ${join(process.cwd(), 'MRCP_EXECUTIVE_REPORT.md')}`);
      console.log(`   📁 Pasta:    ${reportsDir}/\n`);
    }

    if (markdownContent) {
      console.log(markdownContent);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Erro de conexão: ${err.message}`);
    process.exit(1);
  }
}

// 3. Execução sem argumentos
else {
  // Se estiver em um terminal interativo (humano digitou npx mrcp-engine)
  if (process.stdin.isTTY && process.stdout.isTTY) {
    startInteractiveDashboard();
  } 
  // Se for chamado como processo background/stdio por uma IDE (Claude Desktop, Cursor, Antigravity)
  else {
    const mcpServerPath = resolve(__dirname, 'mcp-server.mjs');
    import(mcpServerPath).catch(err => {
      console.error("❌ Falha ao iniciar MCP local:", err);
      process.exit(1);
    });
  }
}
