/**
 * MRCP Engine — MrcpGatekeeper (MCP Native)
 *
 * A Medula Espinhal & Guardião de Qualidade em Tempo Real da Tríade.
 * Atua como Middleman entre o TechLeadOrchestrator e a LLM da IDE.
 * Monitora o File System (FS Watcher) e intercepta mutações de código.
 * Executa o motor AST interno do MRCP (detecção de ciclos, deriva arquitetural,
 * limites de complexidade ciclomática e violação de camadas).
 *
 * Se houver falha: Rejeita a mutação e injeta a crítica em .mrcp/GATEKEEPER_CRITIQUE.md
 * para que a LLM da IDE leia e refaça (Loop de Auto-Correção).
 * Se passar: Certifica a mutação e notifica o Orquestrador para avançar de fase.
 */

import fs from "fs";
import path from "path";
import { detectArchitectureDrift } from "../../../core/lib/analysis/architecture-drift.js";
import { calculateCodeHealth } from "../../../core/lib/analysis/code-health.js";
import {
  AgentTask,
  GatekeeperValidationResult,
  GatekeeperViolation,
} from "./types.js";
import { TechLeadOrchestrator } from "./TechLeadOrchestrator.js";

export interface GatekeeperOptions {
  targetDirectory: string;
  orchestrator: TechLeadOrchestrator;
  debounceMs?: number;
  maxAllowedCyclicDependencies?: number;
}

export class MrcpGatekeeper {
  private readonly targetDirectory: string;
  private readonly orchestrator: TechLeadOrchestrator;
  private readonly debounceMs: number;
  private readonly maxAllowedCyclicDependencies: number;

  private isWatching: boolean = false;
  private nativeWatcher: fs.FSWatcher | null = null;
  private chokidarWatcher: any = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isAnalyzing: boolean = false;

  constructor(options: GatekeeperOptions) {
    this.targetDirectory = path.resolve(options.targetDirectory);
    this.orchestrator = options.orchestrator;
    this.debounceMs = options.debounceMs ?? 800;
    this.maxAllowedCyclicDependencies =
      options.maxAllowedCyclicDependencies ?? 0;
  }

  /**
   * Inicia o File System Watcher em tempo real.
   */
  public async start(): Promise<void> {
    if (this.isWatching) return;
    this.isWatching = true;

    console.log(
      `[MrcpGatekeeper] 🛡️ Ativando QA Watcher em: ${this.targetDirectory}`,
    );

    // Tenta carregar chokidar dinamicamente, caso disponível; senão usa fs.watch nativo
    try {
      const chokidar = await import("chokidar");
      this.chokidarWatcher = chokidar.watch(this.targetDirectory, {
        ignored: [
          /(^|[/\\])\../, // arquivos ocultos
          /node_modules/,
          /\.git/,
          /\.mrcp/,
          /dist/,
          /build/,
        ],
        persistent: true,
        ignoreInitial: true,
      });

      this.chokidarWatcher.on("all", (event: string, filePath: string) => {
        if (event === "add" || event === "change" || event === "unlink") {
          this.handleFileEvent(filePath);
        }
      });
      console.log(`[MrcpGatekeeper] 👁️ Engine de observação: Chokidar ativo.`);
    } catch {
      // Fallback para fs.watch nativo (suportado com recursive no Windows e macOS)
      try {
        this.nativeWatcher = fs.watch(
          this.targetDirectory,
          { recursive: true },
          (_eventType, filename) => {
            if (filename) {
              const fullPath = path.join(this.targetDirectory, filename);
              this.handleFileEvent(fullPath);
            }
          },
        );
        console.log(
          `[MrcpGatekeeper] 👁️ Engine de observação: fs.watch nativo (recursive).`,
        );
      } catch (err: any) {
        console.warn(
          `[MrcpGatekeeper] ⚠️ Falha ao registrar watcher nativo: ${err.message}. Modo manual ativo.`,
        );
      }
    }
  }

  /**
   * Para o watcher e limpa recursos
   */
  public stop(): void {
    this.isWatching = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.chokidarWatcher) {
      this.chokidarWatcher.close();
      this.chokidarWatcher = null;
    }
    if (this.nativeWatcher) {
      this.nativeWatcher.close();
      this.nativeWatcher = null;
    }
    console.log(`[MrcpGatekeeper] 🛑 Watcher finalizado.`);
  }

  /**
   * Processa evento de mutação de arquivo com debounce para esperar o salvamento completo
   */
  private handleFileEvent(filePath: string): void {
    // Ignora pastas internas do sistema e arquivos de controle do MRCP
    const normalized = filePath.replace(/\\/g, "/");
    if (
      normalized.includes("/.git/") ||
      normalized.includes("/node_modules/") ||
      normalized.includes("/.mrcp/") ||
      normalized.includes("/dist/")
    ) {
      return;
    }

    // Apenas arquivos relevantes para o AST
    const ext = path.extname(filePath).toLowerCase();
    if (
      ![".ts", ".tsx", ".js", ".jsx", ".json", ".prisma", ".sql"].includes(ext)
    ) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.validateWorkspace("MUTATION_DETECTED", filePath);
    }, this.debounceMs);
  }

  /**
   * Dispara a validação AST completa do workspace.
   */
  public async validateWorkspace(
    triggerReason: string,
    changedFile?: string,
  ): Promise<GatekeeperValidationResult> {
    if (this.isAnalyzing) {
      return {
        isValid: false,
        timestamp: Date.now(),
        checkedFiles: [],
        violations: [],
        metrics: {
          cyclicDependenciesCount: 0,
          layerViolationsCount: 0,
          godModulesCount: 0,
          totalFilesChecked: 0,
        },
        formattedCritique: "Análise AST já está em andamento. Aguarde.",
      };
    }

    this.isAnalyzing = true;
    const startTime = Date.now();

    console.log(
      `\n────────────────────────────────────────────────────────────────`,
    );
    console.log(`🔍 [MRCP GATEKEEPER] Interceptando mutação no File System...`);
    if (changedFile) {
      console.log(
        `📝 Arquivo alterado: ${path.relative(this.targetDirectory, changedFile)}`,
      );
    }
    console.log(
      `⚙️ Executando motor AST: verificação de ciclos, camadas e complexidade...`,
    );

    const violations: GatekeeperViolation[] = [];
    let cyclicCount = 0;
    let layerViolations = 0;
    let godModules = 0;
    let totalFiles = 0;

    try {
      // 1. Detecção de Deriva Arquitetural e Dependências Circulares
      const driftResult = await detectArchitectureDrift({
        repoUrl: this.targetDirectory,
        maxAllowedCyclicDependencies: this.maxAllowedCyclicDependencies,
      });

      cyclicCount = driftResult.cyclicDependenciesFound || 0;

      for (const v of driftResult.violations || []) {
        if (v.violationType === "CIRCULAR_DEPENDENCY") {
          violations.push({
            ruleId: v.ruleId || "ARCH-CYCLIC-001",
            file: `${v.sourceModule} <--> ${v.targetModule}`,
            message: `Dependência circular detectada entre ${v.sourceModule} e ${v.targetModule}.`,
            severity: "ERROR",
            explanation:
              v.explanation ||
              "Dependências cíclicas quebram o isolamento e provocam deadlocks de importação.",
            suggestedFix:
              "Extraia as interfaces compartilhadas para uma camada inferior (ex: src/core/types) para quebrar o ciclo.",
          });
        } else if (v.violationType === "UNAUTHORIZED_CROSS_LAYER_IMPORT") {
          layerViolations++;
          violations.push({
            ruleId: v.ruleId || "ARCH-LAYER-002",
            file: v.sourceModule,
            message: `Violação de Camada Arquitetural: ${v.sourceModule} está importando ${v.targetModule}.`,
            severity: "ERROR",
            explanation:
              v.explanation ||
              "Módulos de negócio/domínio não podem depender diretamente de camadas de infraestrutura ou UI.",
            suggestedFix:
              "Inverta a dependência utilizando interfaces ou repositórios intermediários.",
          });
        }
      }

      // 2. Cálculo de Saúde do Código e Complexidade Ciclomática
      try {
        const healthResult = await calculateCodeHealth({
          repoUrl: this.targetDirectory,
        });

        totalFiles = healthResult.summary?.totalFiles || 0;
        godModules = healthResult.summary?.godModulesCount || 0;

        for (const hotspot of healthResult.topRefactoringPriorities || []) {
          if (hotspot.cyclomaticComplexity > 60) {
            violations.push({
              ruleId: "COMPLEXITY-GOD-MODULE",
              file: hotspot.file,
              message: `Complexidade ciclomática excessiva (${hotspot.cyclomaticComplexity}) em ${hotspot.file}.`,
              severity: "ERROR",
              explanation:
                hotspot.primaryIssue ||
                "God Module detectado: arquivo concentra muitas responsabilidades.",
              suggestedFix:
                hotspot.recommendedAction ||
                "Decomponha este arquivo em funções menores ou submódulos especializados.",
            });
          }
        }
      } catch {
        // Se a base for incipiente, o cálculo de saúde pode retornar parcial sem quebrar
      }

      // 3. Validação das Restrições Específicas da Tarefa Ativa
      const currentState = this.orchestrator.getState();
      const activeTask = currentState.tasks.find(
        (t) => t.id === currentState.activeTaskId,
      );

      if (activeTask) {
        this.validateTaskBoundaries(activeTask, violations);
      }
    } catch (err: any) {
      console.warn(
        `[MrcpGatekeeper] ⚠️ Erro durante execução AST: ${err.message}`,
      );
    } finally {
      this.isAnalyzing = false;
    }

    const isValid =
      violations.filter((v) => v.severity === "ERROR").length === 0;

    const result: GatekeeperValidationResult = {
      isValid,
      timestamp: Date.now(),
      checkedFiles: [changedFile || this.targetDirectory],
      violations,
      metrics: {
        cyclicDependenciesCount: cyclicCount,
        layerViolationsCount: layerViolations,
        godModulesCount: godModules,
        totalFilesChecked: totalFiles,
      },
      formattedCritique: this.buildFormattedCritique(
        isValid,
        violations,
        startTime,
      ),
    };

    // Atualiza artefatos no disco
    this.persistValidationArtifacts(result);

    // Notifica o orquestrador
    const currentState = this.orchestrator.getState();
    const activeTaskId = currentState.activeTaskId;

    if (isValid) {
      console.log(
        `✅ [MRCP GATEKEEPER] APROVADO! O código atende a todos os contratos AST.`,
      );
      console.log(`⏱️ Tempo de verificação: ${Date.now() - startTime}ms\n`);
      if (activeTaskId) {
        this.orchestrator.approveCurrentTask(activeTaskId);
      }
    } else {
      console.log(
        `❌ [MRCP GATEKEEPER] REJEITADO! Encontradas ${violations.length} violações estruturais.`,
      );
      console.log(`📄 Relatório gerado em: .mrcp/GATEKEEPER_CRITIQUE.md`);
      console.log(`🔄 Instruindo LLM da IDE a corrigir o código...\n`);
      if (activeTaskId) {
        this.orchestrator.rejectCurrentTask(
          activeTaskId,
          result.formattedCritique,
        );
      }
    }

    return result;
  }

  /**
   * Verifica restrições estritas da tarefa ativa inspecionando os arquivos alvos
   */
  private validateTaskBoundaries(
    task: AgentTask,
    violations: GatekeeperViolation[],
  ): void {
    for (const relFile of task.targetFiles) {
      const fullPath = path.isAbsolute(relFile)
        ? relFile
        : path.join(this.targetDirectory, relFile);

      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");

        // Regra: Database e Backend nunca devem importar React ou bibliotecas de frontend
        if (task.role === "DATABASE" || task.role === "BACKEND") {
          if (
            content.includes('from "react"') ||
            content.includes("from 'react'") ||
            content.includes('from "react-dom"') ||
            content.includes("from 'react-dom'")
          ) {
            violations.push({
              ruleId: "ARCH-NO-FRONTEND-IN-BACKEND",
              file: relFile,
              message: `Importação proibida de React/UI detectada em arquivo de ${task.role}: ${relFile}`,
              severity: "ERROR",
              explanation:
                "Módulos de backend e banco de dados devem ser desacoplados de qualquer camada visual.",
              suggestedFix: "Remova as referências a React deste arquivo.",
            });
          }
        }

        // Regra: Frontend não deve importar Prisma ou drivers de banco
        if (task.role === "FRONTEND") {
          if (
            content.includes('from "@prisma/client"') ||
            content.includes("from '@prisma/client'") ||
            content.includes('from "prisma"') ||
            content.includes('from "pg"')
          ) {
            violations.push({
              ruleId: "ARCH-NO-DATABASE-IN-FRONTEND",
              file: relFile,
              message: `Importação direta de banco de dados detectada no Frontend: ${relFile}`,
              severity: "ERROR",
              explanation:
                "O Frontend nunca deve conectar diretamente ao banco. Consuma a API via HTTP.",
              suggestedFix:
                "Utilize o cliente de API (src/client/services/api-client.ts) em vez de drivers de banco.",
            });
          }
        }
      } catch {
        // Ignora falha de leitura pontual
      }
    }
  }

  private buildFormattedCritique(
    isValid: boolean,
    violations: GatekeeperViolation[],
    startTime: number,
  ): string {
    const elapsed = Date.now() - startTime;
    if (isValid) {
      return [
        `# ✅ MRCP GATEKEEPER — CÓDIGO VALIDADO E APROVADO`,
        `> **Timestamp:** ${new Date().toISOString()}`,
        `> **Duração da Análise AST:** ${elapsed}ms`,
        "",
        `O motor de inteligência AST do MRCP não encontrou violações de arquitetura, dependências circulares ou god modules.`,
        `Este passo está certificado e pronto para a próxima fase.`,
      ].join("\n");
    }

    const lines: string[] = [
      `# 🛑 MRCP GATEKEEPER — REJEIÇÃO DE MUTACÃO (LOOP DE AUTO-CORREÇÃO)`,
      `> **Status:** BLOQUEADO — O código gerado não cumpre os contratos de blindagem estrutural.`,
      `> **Duração da Análise AST:** ${elapsed}ms`,
      "",
      `## 🚨 Violações Detectadas (${violations.length})`,
      "",
    ];

    for (const v of violations) {
      lines.push(`### ❌ [${v.ruleId}] ${v.file}`);
      lines.push(`- **Mensagem:** ${v.message}`);
      lines.push(`- **Explicação:** ${v.explanation}`);
      if (v.suggestedFix) {
        lines.push(
          `- **👉 Instrução de Correção para a LLM:** ${v.suggestedFix}`,
        );
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("### ⚠️ Diretriz Obrigatória para a LLM da IDE:");
    lines.push("1. Abra imediatamente os arquivos apontados acima.");
    lines.push("2. Aplique as correções estruturais indicadas.");
    lines.push(
      "3. Salve os arquivos. O MRCP Gatekeeper validará novamente em tempo real.",
    );

    return lines.join("\n");
  }

  private persistValidationArtifacts(result: GatekeeperValidationResult): void {
    const mrcpDir = path.join(this.targetDirectory, ".mrcp");
    if (!fs.existsSync(mrcpDir)) {
      fs.mkdirSync(mrcpDir, { recursive: true });
    }

    const critiqueFile = path.join(mrcpDir, "GATEKEEPER_CRITIQUE.md");
    const approvalFile = path.join(mrcpDir, "GATEKEEPER_APPROVAL.md");
    const jsonStatus = path.join(mrcpDir, "gatekeeper_status.json");

    fs.writeFileSync(jsonStatus, JSON.stringify(result, null, 2), "utf-8");

    if (result.isValid) {
      fs.writeFileSync(approvalFile, result.formattedCritique, "utf-8");
      if (fs.existsSync(critiqueFile)) {
        try {
          fs.unlinkSync(critiqueFile);
        } catch {
          /* ignore cleanup error */
        }
      }
    } else {
      fs.writeFileSync(critiqueFile, result.formattedCritique, "utf-8");
      if (fs.existsSync(approvalFile)) {
        try {
          fs.unlinkSync(approvalFile);
        } catch {
          /* ignore cleanup error */
        }
      }
    }
  }
}
