#!/usr/bin/env node

/**
 * MRCP-Engine CLI
 *
 * Modos de uso:
 *   npx mrcp-engine https://github.com/user/repo   → Analisa e salva mrcp-analysis.json
 *   npx mrcp-engine setup                           → Auto-configura MCP nas IDEs instaladas
 *   npx mrcp-engine (sem args)                      → Inicia servidor MCP local (stdio)
 */

import { createRequire } from "module";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MRCP_API_BASE = "https://mrcp-engine.vercel.app";
const CACHE_FILE = "mrcp-analysis.json";

const args = process.argv.slice(2);

// ─────────────────────────────────────────────
//  Modo 1: Análise de repositório via URL
// ─────────────────────────────────────────────
if (args.length >= 1 && args[0].startsWith("http")) {
  const repoUrl = args[0];
  const noSave = args.includes("--no-save");

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

    // Imprime o JSON na saída padrão
    console.log(JSON.stringify(data, null, 2));

    // Salvar automaticamente (Opção B: sempre salva, --no-save para desabilitar)
    if (!noSave) {
      const outPath = join(process.cwd(), CACHE_FILE);
      try {
        writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
        console.log(`\n✅ Análise salva em: ${outPath}`);
      } catch (saveErr) {
        // Fallback interativo se falhar ao salvar
        console.warn(
          `\n⚠️  Não foi possível salvar automaticamente: ${saveErr.message}`,
        );
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await new Promise((res) => {
          rl.question("   Deseja tentar salvar em outro local? (s/N): ", res);
        });
        rl.close();

        if (answer.toLowerCase() === "s") {
          const altPath = join(
            process.env.HOME || process.env.USERPROFILE || ".",
            CACHE_FILE,
          );
          try {
            writeFileSync(altPath, JSON.stringify(data, null, 2), "utf-8");
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
    console.error("   Verifique sua conexão com a internet e tente novamente.");
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
//  Modo 2: Setup automático de IDEs
// ─────────────────────────────────────────────
else if (args[0] === "setup") {
  console.log("\n🔧 [MRCP-Engine] Auto-configuração de MCP nas IDEs\n");

  const home = process.env.HOME || process.env.USERPROFILE || "";
  const mcpEntry = {
    "mrcp-engine": {
      url: `${MRCP_API_BASE}/api/mcp`,
    },
  };

  // Mapa de IDEs conhecidas e seus arquivos de configuração
  const ideConfigs = [
    {
      name: "Claude Desktop",
      paths: [
        join(
          home,
          "AppData",
          "Roaming",
          "Claude",
          "claude_desktop_config.json",
        ), // Windows
        join(
          home,
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json",
        ), // macOS
        join(home, ".config", "claude", "claude_desktop_config.json"), // Linux
      ],
      key: "mcpServers",
    },
    {
      name: "Cursor",
      paths: [join(home, ".cursor", "mcp.json")],
      key: "mcpServers",
    },
    {
      name: "Windsurf",
      paths: [join(home, ".codeium", "windsurf", "mcp_config.json")],
      key: "mcpServers",
    },
  ];

  let configured = 0;

  for (const ide of ideConfigs) {
    for (const configPath of ide.paths) {
      try {
        let config = {};
        if (existsSync(configPath)) {
          config = JSON.parse(readFileSync(configPath, "utf-8"));
        }

        if (!config[ide.key]) {
          config[ide.key] = {};
        }

        // Verifica se já está configurado
        if (config[ide.key]["mrcp-engine"]) {
          console.log(`   ✅ ${ide.name} — Já configurado`);
          configured++;
          break;
        }

        // Adiciona a entrada MCP
        config[ide.key]["mrcp-engine"] = mcpEntry["mrcp-engine"];

        // Cria diretórios pai se necessário
        const configDir = dirname(configPath);
        const { mkdirSync } = await import("fs");
        mkdirSync(configDir, { recursive: true });

        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(`   ✅ ${ide.name} — Configurado em ${configPath}`);
        configured++;
        break;
      } catch (e) {
        // Tenta o próximo path
        continue;
      }
    }
  }

  if (configured === 0) {
    console.log("   ⚠️  Nenhuma IDE compatível encontrada automaticamente.");
    console.log("   Adicione manualmente ao seu config MCP:\n");
    console.log(JSON.stringify({ mcpServers: mcpEntry }, null, 2));
  } else {
    console.log(
      `\n   🎉 ${configured} IDE(s) configurada(s)! Reinicie a IDE para ativar o MRCP-Engine.`,
    );
  }

  console.log("\n   📖 Para uso manual, adicione esta URL MCP ao seu cliente:");
  console.log(`   ${MRCP_API_BASE}/api/mcp\n`);

  process.exit(0);
}

// ─────────────────────────────────────────────
//  Modo 3: Servidor MCP local (stdio)
//  Usado por IDEs que preferem processo local
// ─────────────────────────────────────────────
else {
  // Importa e roda o servidor MCP
  const mcpServerPath = resolve(__dirname, "../mcp-server.mjs");
  await import(mcpServerPath);
}
