/**
 * MRCP Engine — AgentManager (MCP Native)
 *
 * Gerenciador de Agentes Especialistas da Tríade.
 * Coordena o pool de trabalhadores (DatabaseAgent, BackendAgent, FrontendAgent),
 * prepara os arquivos de contrato, e empacota as diretrizes MCP no disco
 * para que a LLM da IDE possa assumir as personas e cumprir os objetivos.
 */

import fs from "fs";
import path from "path";
import { BaseAgent } from "./BaseAgent.js";
import { DatabaseAgent } from "./agents/DatabaseAgent.js";
import { BackendAgent } from "./agents/BackendAgent.js";
import { FrontendAgent } from "./agents/FrontendAgent.js";
import {
  AgentRole,
  AgentTask,
  GatekeeperValidationResult,
  McpDirectivePrompt,
} from "./types.js";

export class AgentManager {
  private readonly agents: Map<AgentRole, BaseAgent> = new Map();
  private readonly targetDirectory: string;

  constructor(targetDirectory: string) {
    this.targetDirectory = targetDirectory;

    // Registra os especialistas
    this.registerAgent(new DatabaseAgent());
    this.registerAgent(new BackendAgent());
    this.registerAgent(new FrontendAgent());
  }

  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.role, agent);
  }

  public getAgent(role: AgentRole): BaseAgent {
    const agent = this.agents.get(role);
    if (!agent) {
      throw new Error(`Nenhum agente registrado para o papel: ${role}`);
    }
    return agent;
  }

  /**
   * Prepara o terreno para uma tarefa:
   * 1. Cria os arquivos e pastas iniciais se não existirem
   * 2. Gera o MCP Directive Prompt
   * 3. Grava o contexto em .mrcp/ dentro do projeto para consumo da IDE
   */
  public activateTask(
    task: AgentTask,
    critique?: GatekeeperValidationResult,
  ): McpDirectivePrompt {
    const agent = this.getAgent(task.role);

    // 1. Prepara arquivos stubs no disco alvo
    agent.prepareTargetFiles(this.targetDirectory, task);

    // 2. Constrói o Prompt Directive MCP
    const directive = agent.buildMcpDirective(
      task,
      this.targetDirectory,
      critique,
    );

    // 3. Persiste a diretiva no workspace (.mrcp/) para que Cursor/Antigravity/Claude vejam
    this.persistDirectiveForIde(task, directive);

    return directive;
  }

  /**
   * Grava as instruções da missão ativa no diretório .mrcp/ do projeto
   */
  private persistDirectiveForIde(
    task: AgentTask,
    directive: McpDirectivePrompt,
  ): void {
    const mrcpDir = path.join(this.targetDirectory, ".mrcp");
    if (!fs.existsSync(mrcpDir)) {
      fs.mkdirSync(mrcpDir, { recursive: true });
    }

    const missionJsonPath = path.join(mrcpDir, "active_mission.json");
    const directiveMdPath = path.join(mrcpDir, "ACTIVE_PROMPT_DIRECTIVE.md");

    // Salva JSON estruturado
    fs.writeFileSync(
      missionJsonPath,
      JSON.stringify(
        {
          task,
          directive,
          timestamp: Date.now(),
        },
        null,
        2,
      ),
      "utf-8",
    );

    // Salva Markdown pronto para a LLM da IDE ler
    const mdContent = [
      `# 🤖 MRCP ENGINE — DIRETIVA ATIVA PARA LLM DA IDE`,
      `> **Papel Atual:** \`${directive.personaTitle}\` (\`${directive.role}\`)`,
      `> **Tarefa:** \`[${task.id}] ${task.title}\``,
      "",
      `## 🎯 Objetivo da Missão`,
      directive.objective,
      "",
      `## 📁 Arquivos Alvo (Escreva ou edite estes arquivos)`,
      ...task.targetFiles.map((f) => `- \`${f}\``),
      "",
      `## 📜 Instruções de Implementação`,
      ...directive.activeTask.instructions.map((ins) => `1. ${ins}`),
      "",
      `## 🛡️ Fronteiras Arquiteturais (O MRCP Gatekeeper validará via AST)`,
      `### Imports Permitidos:`,
      ...directive.architecturalBoundaries.allowedImports.map(
        (i) => `- \`${i}\``,
      ),
      `### Imports Proibidos (Violação imediata):`,
      ...directive.architecturalBoundaries.forbiddenImports.map(
        (i) => `- ❌ \`${i}\``,
      ),
      `### Recomendações:`,
      ...directive.architecturalBoundaries.guidelines.map((g) => `- ${g}`),
      "",
      directive.rejectionCritique
        ? `## 🚨 Crítica do Gatekeeper (Corrija antes de prosseguir)\n\n\`\`\`\n${directive.rejectionCritique}\n\`\`\`\n`
        : "",
      `## ⚡ Expectativa de Saída`,
      directive.outputExpectation,
      "",
      `---`,
      `*Instrução automática gerada pelo MRCP-Engine Autonomous Triad.*`,
    ].join("\n");

    fs.writeFileSync(directiveMdPath, mdContent, "utf-8");
  }

  /**
   * Obtém lista de todos os agentes registrados
   */
  public listRegisteredAgents(): Array<{ role: AgentRole; title: string }> {
    const list: Array<{ role: AgentRole; title: string }> = [];
    for (const [role, agent] of this.agents.entries()) {
      list.push({ role, title: agent.personaTitle });
    }
    return list;
  }
}
