/**
 * MRCP Engine — BaseAgent (MCP Native)
 *
 * Classe base para todos os Agentes Especialistas da Tríade.
 * NÃO executa chamadas HTTP para APIs de IA externas (zero LLM interno).
 * Sua missão é empacotar o contexto estrutural, contratos AST e limites
 * de código, gerando MCP Directive Prompts para comandar a LLM da IDE.
 */

import fs from "fs";
import path from "path";
import {
  AgentRole,
  AgentTask,
  GatekeeperValidationResult,
  McpDirectivePrompt,
} from "./types.js";

export abstract class BaseAgent {
  public abstract readonly role: AgentRole;
  public abstract readonly personaTitle: string;
  public abstract readonly defaultSystemRules: string[];

  /**
   * Constrói o MCP Directive Prompt completo que força a LLM da IDE
   * a assumir o papel deste agente e respeitar todas as fronteiras arquiteturais.
   */
  public buildMcpDirective(
    task: AgentTask,
    targetDirectory: string,
    critique?: GatekeeperValidationResult,
  ): McpDirectivePrompt {
    const boundaries = this.getArchitecturalBoundaries(task);
    const rejectionText =
      critique && !critique.isValid ? critique.formattedCritique : undefined;

    return {
      role: this.role,
      personaTitle: this.personaTitle,
      objective: `[MISSÃO] ${task.title} — ${task.description}`,
      activeTask: {
        id: task.id,
        title: task.title,
        targetFiles: task.targetFiles,
        instructions: [
          ...task.architecturalRules,
          ...this.defaultSystemRules,
          `Diretório base do projeto: ${targetDirectory}`,
          "Crie os arquivos estritamente nos caminhos indicados em targetFiles.",
          "NÃO crie dependências circulares nem importe módulos de camadas externas não autorizadas.",
          "Mantenha a complexidade ciclomática baixa por função/método (máximo 20 por função, 50 por arquivo).",
          "O MRCP Gatekeeper interceptará cada salvamento e bloqueará o progresso caso haja violações AST.",
        ],
      },
      architecturalBoundaries: boundaries,
      rejectionCritique: rejectionText,
      requiredMcpTools: [
        "mrcp_type_signature_extractor",
        "mrcp_impact_analysis",
        "analyze_repository",
      ],
      outputExpectation:
        "Gere o código integral diretamente nos arquivos do projeto usando as ferramentas de escrita da IDE. Não use placeholders como '// restante do código'. Escreva cada arquivo por completo.",
    };
  }

  /**
   * Retorna fronteiras de importação e regras específicas da especialidade do agente.
   */
  protected abstract getArchitecturalBoundaries(task: AgentTask): {
    allowedImports: string[];
    forbiddenImports: string[];
    guidelines: string[];
  };

  /**
   * Gera um template ou esqueleto inicial de arquivos no disco para guiar a LLM da IDE,
   * garantindo que a estrutura de diretórios e arquivos exista antes da implementação.
   */
  public prepareTargetFiles(targetDirectory: string, task: AgentTask): void {
    for (const relativeFile of task.targetFiles) {
      const fullPath = path.isAbsolute(relativeFile)
        ? relativeFile
        : path.join(targetDirectory, relativeFile);

      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(fullPath)) {
        const initialStub = this.generateFileInitialStub(relativeFile, task);
        fs.writeFileSync(fullPath, initialStub, "utf-8");
      }
    }
  }

  /**
   * Gera um esqueleto tipado para o arquivo recém-criado para fornecer o ponto de partida.
   */
  protected generateFileInitialStub(filePath: string, task: AgentTask): string {
    const ext = path.extname(filePath);
    const base = path.basename(filePath);

    if (ext === ".ts" || ext === ".tsx") {
      return `/**\n * ${base}\n * Tarefa MRCP: [${task.id}] ${task.title}\n * Papel: ${this.personaTitle}\n * ATENÇÃO: Implemente este arquivo integralmente seguindo as regras do MRCP Gatekeeper.\n */\n\n`;
    }

    if (ext === ".json") {
      return `{\n  "name": "${base}",\n  "task": "${task.id}"\n}\n`;
    }

    if (ext === ".sql") {
      return `-- ${base}\n-- Tarefa MRCP: [${task.id}] ${task.title}\n-- Modelagem estrita via MRCP Database Agent\n\n`;
    }

    return `// ${base} - Tarefa MRCP: [${task.id}]\n`;
  }

  /**
   * Formata a crítica gerada pelo Gatekeeper em um payload de auto-correção imperativo
   * para guiar a LLM da IDE no conserto imediato do código.
   */
  public formatCorrectionDirective(
    task: AgentTask,
    validation: GatekeeperValidationResult,
  ): string {
    const lines: string[] = [
      "════════════════════════════════════════════════════════════════════════════════",
      `🛑 [MRCP GATEKEEPER] MUTACÃO REJEITADA NO AGENTE: ${this.personaTitle}`,
      `📌 TAREFA ATIVA: [${task.id}] ${task.title}`,
      `Tentativa atual: ${task.retryCount + 1} de ${task.maxRetries}`,
      "════════════════════════════════════════════════════════════════════════════════",
      "",
      "O motor de análise AST detectou que o código gerado violou contratos fundamentais.",
      "Você (LLM da IDE) DEVE corrigir esses arquivos imediatamente antes de prosseguir:",
      "",
    ];

    for (const v of validation.violations) {
      lines.push(
        `❌ [${v.ruleId}] ${v.file}${v.line ? ` (Linha ${v.line})` : ""}`,
      );
      lines.push(`   Mensagem: ${v.message}`);
      lines.push(`   Motivo:   ${v.explanation}`);
      if (v.suggestedFix) {
        lines.push(`   👉 Correção Obrigatória: ${v.suggestedFix}`);
      }
      lines.push("");
    }

    lines.push(
      "════════════════════════════════════════════════════════════════════════════════",
    );
    lines.push("REESCREVA OS ARQUIVOS AFETADOS CORRIGINDO AS VIOLAÇÕES ACIMA.");
    lines.push(
      "O MRCP Gatekeeper continuará assistindo o File System e validará novamente.",
    );
    lines.push(
      "════════════════════════════════════════════════════════════════════════════════",
    );

    return lines.join("\n");
  }
}
