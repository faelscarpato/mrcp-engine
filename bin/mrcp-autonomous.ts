#!/usr/bin/env node

/**
 * MRCP Engine — Bootstrap CLI Autônomo
 *
 * Comando: mrcp-engine auto "<prompt>" [--dir <caminho>]
 *
 * Inicializa a Tríade de Orquestração:
 * 1. O Cérebro: TechLeadOrchestrator (Pesquisa web autônoma + Decomposição em tarefas)
 * 2. O Executor: AgentManager & Agentes Especialistas (Diretivas MCP no disco)
 * 3. A Medula Espinhal / QA: MrcpGatekeeper (Watcher em tempo real + Validação AST)
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  TechLeadOrchestrator,
  MrcpGatekeeper,
  AgentTask,
} from "../packages/cli/src/orchestrator/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parsing simples de argumentos CLI
const args = process.argv.slice(2);

function printHelp(): void {
  console.log(`
🧠 MRCP Engine — Modo Autônomo (Tech Lead & Real-time Gatekeeper)

Uso:
  npx mrcp-engine auto "<prompt-macro>" [opções]
  npx tsx bin/mrcp-autonomous.ts "<prompt-macro>" [opções]

Exemplos:
  npx mrcp-engine auto "Crie um SaaS de clínicas médicas com prontuário e agendamento"
  npx mrcp-engine auto "Construa uma API de pagamentos com webhook e conciliação" --dir ./pagamentos-app

Opções:
  --dir <caminho>       Diretório onde o projeto será gerado (Padrão: ./generated-app)
  --help                Exibe esta mensagem de ajuda
`);
}

async function main(): Promise<void> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  // Extrai prompt e flags
  const promptParts: string[] = [];
  let targetDir = path.resolve(process.cwd(), "generated-app");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "auto") {
      continue;
    } else if (args[i] === "--dir" && i + 1 < args.length) {
      targetDir = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (!args[i].startsWith("-")) {
      promptParts.push(args[i]);
    }
  }

  const prompt = promptParts.join(" ").trim();

  if (!prompt) {
    console.error(
      "❌ Erro: Por favor, forneça a descrição do que deseja construir.",
    );
    console.error(
      '   Exemplo: npx mrcp-engine auto "Crie um SaaS de agendamentos"',
    );
    process.exit(1);
  }

  console.clear();
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║   🧠  M R C P   E N G I N E  —  T R Í A D E   A U T Ô N O M A                   ║
║       Orquestrador Tech Lead  •  Agentes Especialistas  •  Gatekeeper AST        ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
`);
  console.log(`📌 Macro-Missão: "${prompt}"`);
  console.log(`📂 Diretório Alvo: ${targetDir}`);
  console.log(
    `🛡️ Gatekeeper AST: Ativo com observação de File System em tempo real`,
  );
  console.log(
    `⚡ Modo MCP Native: Sem chaves de LLM externas. Conduzindo a IA da sua IDE!\n`,
  );

  // 1. Inicializa o TechLeadOrchestrator
  const orchestrator = new TechLeadOrchestrator(prompt, targetDir);
  await orchestrator.initializeWorkspace();

  // 2. FASE 1: Pesquisa Autônoma de Arquitetura na Web
  console.log(
    `\n━━━ FASE 1: PESQUISA AUTÔNOMA DE ARQUITETURA & TENDÊNCIAS ━━━━━━━━━━━`,
  );
  const research = await orchestrator.conductResearch();
  console.log(
    `✅ Pesquisa concluída com sucesso (${research.length} buscas consolidadas).`,
  );

  // 3. FASE 2: Planejamento Arquitetural & Contratos de Agentes
  console.log(
    `\n━━━ FASE 2: DECOMPOSIÇÃO ARQUITETURAL & CONTRATOS AST ━━━━━━━━━━━━━━━`,
  );
  const plan = await orchestrator.planArchitecture(research);
  console.log(`🏛️ Projeto: ${plan.projectName}`);
  console.log(`📦 Tarefas Criadas: ${plan.tasks.length}`);
  for (const t of plan.tasks) {
    console.log(`   ├─ [${t.id}] ${t.title} (${t.role})`);
  }
  console.log(
    `📄 Plano Master salvo em: ${path.join(targetDir, ".mrcp", "ARCHITECTURE_PLAN.md")}`,
  );

  // 4. FASE 3: Inicialização da Medula Espinhal (MRCP Gatekeeper)
  console.log(
    `\n━━━ FASE 3: INICIALIZAÇÃO DO MRCP GATEKEEPER (REAL-TIME QA) ━━━━━━━━━`,
  );
  const gatekeeper = new MrcpGatekeeper({
    targetDirectory: targetDir,
    orchestrator,
    debounceMs: 800,
  });

  await gatekeeper.start();

  // 5. FASE 4: Despacho da Primeira Tarefa
  console.log(
    `\n━━━ FASE 4: EXECUÇÃO CONDUZIDA PELA LLM DA IDE ━━━━━━━━━━━━━━━━━━━━━━`,
  );
  const firstTask = orchestrator.getNextPendingTask();
  if (firstTask) {
    orchestrator.dispatchTask(firstTask);
  } else {
    console.log("ℹ️ Nenhuma tarefa inicial pendente encontrada.");
  }

  console.log(`
┌──────────────────────────────────────────────────────────────────────────────────┐
│  👉 INSTRUÇÃO PARA O DESENVOLVEDOR / LLM DA SUA IDE:                             │
│                                                                                  │
│  Abra o arquivo gerado:                                                          │
│  📄 ${path.join(targetDir, ".mrcp", "ACTIVE_PROMPT_DIRECTIVE.md")}               │
│                                                                                  │
│  A LLM da sua IDE (Claude Desktop, Cursor, Antigravity, Windsurf) deve ler       │
│  a diretiva e implementar os arquivos solicitados.                               │
│                                                                                  │
│  O MRCP Gatekeeper está observando o File System agora! Cada arquivo salvo       │
│  será inspecionado pelo motor AST. O próximo passo será liberado assim que       │
│  a validação estrutural for 100% aprovada.                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
`);

  // Loop de monitoramento para avançar tarefas automaticamente
  let isCompleted = false;

  const intervalId = setInterval(async () => {
    const state = orchestrator.getState();

    // Se a tarefa ativa foi aprovada, despacha a próxima
    if (state.phase === "APPROVED" && !state.activeTaskId) {
      const nextTask = orchestrator.getNextPendingTask();
      if (nextTask) {
        console.log(`\n🎉 Passo anterior certificado pelo Gatekeeper!`);
        orchestrator.dispatchTask(nextTask);
      } else {
        // Todas as tarefas foram aprovadas!
        if (!isCompleted) {
          isCompleted = true;
          clearInterval(intervalId);

          console.log(`
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║   🏆  M I S S Ã O   C O N C L U Í D A   C O M   S U C E S S O !                  ║
║       Todas as tarefas foram implementadas e certificadas pelo Gatekeeper AST.  ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
`);
          console.log(`📂 Código validado e pronto em: ${targetDir}`);
          console.log(`📊 Relatórios em: ${path.join(targetDir, ".mrcp")}\n`);

          gatekeeper.stop();
          process.exit(0);
        }
      }
    }
  }, 1500);

  // Captura encerramento gracioso (Ctrl+C)
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Encerrando Tríade Autônoma do MRCP-Engine...");
    gatekeeper.stop();
    clearInterval(intervalId);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("\n❌ Erro fatal na Tríade Autônoma:", err);
  process.exit(1);
});
