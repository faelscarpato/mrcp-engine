#!/usr/bin/env node

/**
 * MRCP-Engine CLI
 * 
 * Modos de uso:
 *   npx mrcp-engine https://github.com/user/repo   → Analisa e salva mrcp-analysis.json
 *   npx mrcp-engine setup                          → Auto-configura MCP nas IDEs instaladas
 *   npx mrcp-engine                                → Inicia servidor MCP local (stdio)
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MRCP_API_BASE = 'https://mrcp-engine.vercel.app';
const CACHE_FILE = 'mrcp-analysis.json';

const args = process.argv.slice(2);

// ─────────────────────────────────────────────
//  Modo 1: Análise de repositório via URL
// ─────────────────────────────────────────────
if (args.length >= 1 && args[0].startsWith('http')) {
  const repoUrl = args[0];
  const noSave = args.includes('--no-save');

  console.log(`\n🔍 [MRCP-Engine] Analisando: ${repoUrl}\n`);
  console.log(`   Delegando processamento para ${MRCP_API_BASE}...\n`);

  try {
    const apiUrl = `${MRCP_API_BASE}/api/analyze?repo=${encodeURIComponent(repoUrl)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Erro da API (HTTP ${response.status}): ${errorBody}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    if (!noSave) {
      const outPath = join(process.cwd(), CACHE_FILE);
      try {
        writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`\n✅ Análise salva em: ${outPath}`);
      } catch (saveErr) {
        console.warn(`\n⚠️  Não foi possível salvar automaticamente: ${saveErr.message}`);
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(res => {
          rl.question('   Deseja tentar salvar em outro local? (s/N): ', res);
        });
        rl.close();

        if (answer.toLowerCase() === 's') {
          const altPath = join(process.env.HOME || process.env.USERPROFILE || '.', CACHE_FILE);
          try {
            writeFileSync(altPath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`   ✅ Salvo em: ${altPath}`);
          } catch (e2) {
            console.error(`   ❌ Falha ao salvar: ${e2.message}`);
          }
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Erro de conexão: ${err.message}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
//  Modo 2: Setup automático de IDEs
// ─────────────────────────────────────────────
else if (args[0] === 'setup') {
  console.log('\n🔧 [MRCP-Engine] Auto-configuração de MCP nas IDEs e Plataformas\n');

  const home = process.env.HOME || process.env.USERPROFILE || '';
  const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
  
  // Entradas de configuração dependendo da plataforma
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
      entry: antigravityEntry, // Antigravity usa serverUrl
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
        // Falha ignorada, tenta próximo path se houver
        continue;
      }
    }
  }

  if (configured === 0) {
    console.log('   ⚠️  Nenhuma pasta de IDE foi encontrada na sua máquina.');
  } else {
    console.log(`\n   🎉 ${configured} integração(ões) ativada(s)! Reinicie as IDEs para usar o MRCP-Engine.`);
  }

  process.exit(0);
}

// ─────────────────────────────────────────────
//  Modo 3: Servidor MCP local (stdio)
// ─────────────────────────────────────────────
else {
  const mcpServerPath = resolve(__dirname, 'mcp-server.mjs');
  import(mcpServerPath).catch(err => {
    console.error("❌ Falha ao iniciar MCP local:", err);
    process.exit(1);
  });
}
