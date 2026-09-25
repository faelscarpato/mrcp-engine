/**
 * MRCP Engine — TechLeadOrchestrator (MCP Native)
 *
 * O Cérebro da Tríade de Orquestração Autônoma.
 * Recebe o prompt macro do usuário, executa pesquisa autônoma de tendências e
 * arquiteturas na web via DuckDuckGo/Cheerio (ferramentas nativas do MRCP),
 * projeta a arquitetura modular e decompõe o projeto em contratos de tarefas (AgentTasks).
 * NÃO realiza chamadas HTTP para LLMs externas; delega a execução para a IDE via MCP.
 */

import fs from "fs";
import path from "path";
import {
  searchDuckDuckGo,
  scrapeUrl,
  SearchResult,
} from "../../../core/lib/web/scraper-tools.js";
import {
  AgentRole,
  AgentTask,
  ArchitecturePlan,
  OrchestratorState,
  ResearchFinding,
} from "./types.js";
import { AgentManager } from "./AgentManager.js";

export class TechLeadOrchestrator {
  private readonly projectGoal: string;
  private readonly targetDirectory: string;
  private readonly agentManager: AgentManager;
  private state: OrchestratorState;

  constructor(projectGoal: string, targetDirectory: string) {
    this.projectGoal = projectGoal;
    this.targetDirectory = path.resolve(targetDirectory);
    this.agentManager = new AgentManager(this.targetDirectory);

    this.state = {
      projectGoal,
      targetDir: this.targetDirectory,
      phase: "IDLE",
      plan: null,
      activeTaskId: null,
      tasks: [],
      lastValidation: null,
      history: [
        {
          timestamp: Date.now(),
          phase: "IDLE",
          message: "TechLeadOrchestrator instanciado e pronto.",
        },
      ],
    };
  }

  public getState(): OrchestratorState {
    return { ...this.state };
  }

  public getAgentManager(): AgentManager {
    return this.agentManager;
  }

  /**
   * Fase 1: Pesquisa Autônoma de Arquitetura & Tendências
   * Se houver lacunas ou para consolidar a melhor stack, invoca o motor de busca nativo do MRCP.
   */
  public async conductResearch(): Promise<ResearchFinding[]> {
    this.transitionPhase(
      "RESEARCHING",
      "Iniciando pesquisa de arquitetura na Web...",
    );

    const keywords = this.extractDomainKeywords(this.projectGoal);
    const queries = [
      `best architecture modern stack ${keywords} typescript`,
      `clean architecture schema database model ${keywords}`,
    ];

    const findings: ResearchFinding[] = [];

    for (const query of queries) {
      try {
        console.log(
          `[TechLeadOrchestrator] 🌐 Pesquisando: "${query}" via DuckDuckGo...`,
        );
        const searchResults: SearchResult[] = await searchDuckDuckGo(query);

        const topResults = searchResults.slice(0, 3);
        const urls = topResults.map((r) => r.url).filter(Boolean);
        const snippetSummary = topResults
          .map((r) => `- [${r.title}] ${r.snippet}`)
          .join("\n");

        // Opcional: faz scrape superficial da primeira página para extrair tópicos chave
        const recommendedPatterns: string[] = [
          "Clean Architecture com separação em camadas (Domain, Application, Infrastructure)",
          "Separação estrita entre modelos de banco e schemas de validação DTO",
          "Isolamento entre componentes de interface e regras de negócio de backend",
        ];

        if (urls.length > 0) {
          try {
            const pageData = await scrapeUrl(urls[0]);
            if (pageData && pageData.headings && pageData.headings.length > 0) {
              const relevantHeadings = pageData.headings
                .slice(0, 5)
                .map((h) => h.trim())
                .filter((h) => h.length > 3);
              if (relevantHeadings.length > 0) {
                recommendedPatterns.push(...relevantHeadings);
              }
            }
          } catch {
            // Scrape silencioso caso URL externa falhe
          }
        }

        findings.push({
          query,
          timestamp: Date.now(),
          snippetSummary:
            snippetSummary || "Padrões consolidados da comunidade TypeScript.",
          urls,
          recommendedPatterns,
        });
      } catch (err: any) {
        console.warn(
          `[TechLeadOrchestrator] ⚠️ Aviso na busca web: ${err.message}`,
        );
        findings.push({
          query,
          timestamp: Date.now(),
          snippetSummary:
            "Padrão arquitetural padrão MRCP (Clean Architecture / TypeScript).",
          urls: [],
          recommendedPatterns: [
            "Clean Architecture",
            "Zod Data Contracts",
            "Repository Pattern",
          ],
        });
      }
    }

    return findings;
  }

  /**
   * Fase 2: Decomposição Arquitetural & Criação dos Contratos de Tarefas
   */
  public async planArchitecture(
    researchFindings: ResearchFinding[],
  ): Promise<ArchitecturePlan> {
    this.transitionPhase(
      "PLANNING",
      "Decompondo macro-objetivo em tarefas de Agentes Especialistas...",
    );

    const safeSlug = this.projectGoal
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);

    const projectName = `mrcp-app-${safeSlug}`;

    // Define stack moderna padrão com base nas tendências
    const techStack = {
      frontend: [
        "React 19 / Next.js",
        "TailwindCSS",
        "Lucide Icons",
        "Zod DTOs",
      ],
      backend: [
        "Node.js / TypeScript",
        "Express / Hono API",
        "Zod Validation",
        "JWT Auth",
      ],
      database: [
        "PostgreSQL / SQLite",
        "Prisma / Drizzle ORM",
        "Strict Relational Integrity",
      ],
      tooling: ["TypeScript 5+", "MRCP Engine AST Quality Gatekeeper"],
    };

    const directoryStructure: Record<string, string> = {
      "src/core": "Interfaces de domínio e tipos compartilhados",
      "src/db": "Modelos de banco de dados, schemas e migrações",
      "src/db/repositories": "Acesso a dados e operações de persistência",
      "src/server": "Controllers, services de backend e rotas HTTP",
      "src/client": "Componentes de UI, hooks e serviços de API frontend",
    };

    // Cria as tarefas estruturadas na ordem determinística:
    // 1. DATABASE -> 2. BACKEND -> 3. FRONTEND
    const now = Date.now();
    const tasks: AgentTask[] = [
      {
        id: "TASK-DB-001",
        title: "Modelagem de Dados e Schemas Relacionais",
        description: `Projete e implemente o schema de banco de dados para '${this.projectGoal}'. Garanta entidades normalizadas, chaves estrangeiras e índices.`,
        role: "DATABASE",
        targetFiles: [
          "src/db/schema.prisma",
          "src/db/entities.ts",
          "src/db/client.ts",
        ],
        architecturalRules: [
          "Defina todas as entidades com campos obrigatórios e tipados.",
          "Crie relações 1:N e N:N com integridade referencial.",
          "Proibido importar módulos de UI ou express.",
          "Exporte tipos TypeScript para todas as entidades criadas.",
        ],
        dependencies: [],
        status: "PENDING",
        assignedAgent: "MRCP Database & Schema Architect",
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "TASK-BACKEND-002",
        title: "Serviços de Regra de Negócio e Rotas de API",
        description: `Implemente os serviços de aplicação, controllers e endpoints HTTP para '${this.projectGoal}'.`,
        role: "BACKEND",
        targetFiles: [
          "src/server/services/app-service.ts",
          "src/server/controllers/app-controller.ts",
          "src/server/routes.ts",
        ],
        architecturalRules: [
          "Consuma a camada de banco através das entidades definidas em src/db/.",
          "Valide todos os dados de entrada usando Zod schemas.",
          "Proibido importar qualquer biblioteca de interface ou React.",
          "Retorne respostas estruturadas com status HTTP adequados.",
        ],
        dependencies: ["TASK-DB-001"],
        status: "PENDING",
        assignedAgent: "MRCP Backend & API Engineer",
        retryCount: 0,
        maxRetries: 3,
        createdAt: now + 1,
        updatedAt: now + 1,
      },
      {
        id: "TASK-FRONTEND-003",
        title: "Interface de Usuário, Telas Principais e Clientes de API",
        description: `Construa a interface responsiva e interativa para '${this.projectGoal}', consumindo os endpoints criados.`,
        role: "FRONTEND",
        targetFiles: [
          "src/client/services/api-client.ts",
          "src/client/components/Dashboard.tsx",
          "src/client/components/ItemForm.tsx",
          "src/client/App.tsx",
        ],
        architecturalRules: [
          "Proibido acessar o banco de dados diretamente; consuma apenas src/client/services/api-client.ts.",
          "Mantenha componentes modulares com tipagens estritas de props.",
          "Implemente estados visuais de loading, erro e sucesso.",
          "Estruture formulários com validação amigável ao usuário.",
        ],
        dependencies: ["TASK-BACKEND-002"],
        status: "PENDING",
        assignedAgent: "MRCP Frontend & UI Architect",
        retryCount: 0,
        maxRetries: 3,
        createdAt: now + 2,
        updatedAt: now + 2,
      },
    ];

    const plan: ArchitecturePlan = {
      projectName,
      macroGoal: this.projectGoal,
      targetDirectory: this.targetDirectory,
      techStack,
      directoryStructure,
      boundaries: {
        frontendAllowedImports: ["src/client", "src/core"],
        backendForbiddenImports: ["src/client", "react", "vue"],
        coreIsolated: true,
      },
      tasks,
      researchSummary: researchFindings,
    };

    this.state.plan = plan;
    this.state.tasks = tasks;

    // Salva o plano completo no disco
    this.persistArchitecturePlan(plan);

    return plan;
  }

  /**
   * Prepara o diretório de destino e inicia o fluxo de despacho de tarefas.
   */
  public async initializeWorkspace(): Promise<void> {
    if (!fs.existsSync(this.targetDirectory)) {
      fs.mkdirSync(this.targetDirectory, { recursive: true });
    }

    const mrcpDir = path.join(this.targetDirectory, ".mrcp");
    if (!fs.existsSync(mrcpDir)) {
      fs.mkdirSync(mrcpDir, { recursive: true });
    }
  }

  /**
   * Seleciona a próxima tarefa pendente cujas dependências foram aprovadas.
   */
  public getNextPendingTask(): AgentTask | null {
    const approvedIds = new Set(
      this.state.tasks.filter((t) => t.status === "APPROVED").map((t) => t.id),
    );

    for (const task of this.state.tasks) {
      if (task.status === "PENDING" || task.status === "REJECTED") {
        const canRun = task.dependencies.every((depId) =>
          approvedIds.has(depId),
        );
        if (canRun) {
          return task;
        }
      }
    }

    return null;
  }

  /**
   * Ativa a tarefa no AgentManager e atualiza o estado do Orquestrador.
   */
  public dispatchTask(task: AgentTask): void {
    task.status = "IN_PROGRESS";
    task.updatedAt = Date.now();
    this.state.activeTaskId = task.id;

    this.transitionPhase(
      "WAITING_IDE_LLM",
      `Tarefa ativada: [${task.id}] ${task.title}. Aguardando escrita da LLM da IDE...`,
    );

    // Ativa no AgentManager
    const directive = this.agentManager.activateTask(task);

    console.log(
      `\n────────────────────────────────────────────────────────────────`,
    );
    console.log(`🚀 [ORQUESTRADOR] TAREFA DESPACHADA: [${task.id}]`);
    console.log(`🎭 Papel:   ${directive.personaTitle}`);
    console.log(`🎯 Missão:  ${task.title}`);
    console.log(`📁 Alvos:   ${task.targetFiles.join(", ")}`);
    console.log(`📄 Diretiva gravada em: .mrcp/ACTIVE_PROMPT_DIRECTIVE.md`);
    console.log(
      `────────────────────────────────────────────────────────────────\n`,
    );
  }

  /**
   * Marca a tarefa atual como concluída e aprovada pelo Gatekeeper.
   */
  public approveCurrentTask(taskId: string): void {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = "APPROVED";
      task.updatedAt = Date.now();
      this.state.activeTaskId = null;
      this.transitionPhase(
        "APPROVED",
        `Tarefa [${taskId}] aprovada pelo MRCP Gatekeeper!`,
      );
      this.updateMissionStatusFile();
    }
  }

  /**
   * Trata a rejeição da tarefa pelo Gatekeeper.
   */
  public rejectCurrentTask(taskId: string, critiqueText: string): void {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.retryCount++;
      task.updatedAt = Date.now();

      if (task.retryCount > task.maxRetries) {
        task.status = "FAILED";
        this.transitionPhase(
          "FAILED",
          `Tarefa [${taskId}] atingiu o limite de ${task.maxRetries} tentativas.`,
        );
      } else {
        task.status = "REJECTED";
        this.transitionPhase(
          "WAITING_IDE_LLM",
          `Tarefa [${taskId}] rejeitada pelo Gatekeeper. Tentativa ${task.retryCount}/${task.maxRetries}.`,
        );
      }

      this.updateMissionStatusFile();
    }
  }

  private transitionPhase(
    phase: OrchestratorState["phase"],
    message: string,
  ): void {
    this.state.phase = phase;
    this.state.history.push({
      timestamp: Date.now(),
      phase,
      message,
    });
    console.log(`[TechLeadOrchestrator] ⏱️ (${phase}) ${message}`);
  }

  private extractDomainKeywords(goal: string): string {
    const stopwords = new Set([
      "crie",
      "um",
      "uma",
      "de",
      "para",
      "com",
      "em",
      "o",
      "a",
      "os",
      "as",
      "build",
      "create",
      "a",
      "an",
      "the",
      "for",
      "with",
      "system",
      "app",
    ]);

    const words = goal
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

    return words.slice(0, 4).join(" ") || "web application";
  }

  private persistArchitecturePlan(plan: ArchitecturePlan): void {
    const mrcpDir = path.join(this.targetDirectory, ".mrcp");
    if (!fs.existsSync(mrcpDir)) {
      fs.mkdirSync(mrcpDir, { recursive: true });
    }

    const planJson = path.join(mrcpDir, "ARCHITECTURE_PLAN.json");
    const planMd = path.join(mrcpDir, "ARCHITECTURE_PLAN.md");

    fs.writeFileSync(planJson, JSON.stringify(plan, null, 2), "utf-8");

    const mdContent = [
      `# 🏛️ Plano Arquitetural Master: ${plan.projectName}`,
      `> **Objetivo:** ${plan.macroGoal}`,
      `> **Diretório:** \`${plan.targetDirectory}\``,
      "",
      `## 📦 Tech Stack Recomendada`,
      `- **Frontend:** ${plan.techStack.frontend.join(", ")}`,
      `- **Backend:** ${plan.techStack.backend.join(", ")}`,
      `- **Database:** ${plan.techStack.database.join(", ")}`,
      `- **Tooling:** ${plan.techStack.tooling.join(", ")}`,
      "",
      `## 📁 Topologia de Diretórios`,
      ...Object.entries(plan.directoryStructure).map(
        ([d, desc]) => `- \`${d}/\`: ${desc}`,
      ),
      "",
      `## 📋 Fila de Tarefas dos Agentes (Ordem de Execução)`,
      ...plan.tasks.map(
        (t) =>
          `### [${t.status}] ${t.id}: ${t.title}\n- **Papel:** ${t.role} (${t.assignedAgent})\n- **Alvos:** ${t.targetFiles.join(", ")}\n- **Dependências:** ${t.dependencies.length > 0 ? t.dependencies.join(", ") : "Nenhuma (Inicial)"}\n`,
      ),
      "",
      `## 🔍 Síntese da Pesquisa Web`,
      ...plan.researchSummary.map(
        (r) =>
          `#### Consulta: \`${r.query}\`\n${r.snippetSummary}\n- **Padrões:** ${r.recommendedPatterns.join(", ")}\n`,
      ),
      "",
      `---`,
      `*Gerado de forma autônoma pelo MRCP TechLeadOrchestrator.*`,
    ].join("\n");

    fs.writeFileSync(planMd, mdContent, "utf-8");
  }

  private updateMissionStatusFile(): void {
    const statusFile = path.join(
      this.targetDirectory,
      ".mrcp",
      "mission_status.json",
    );
    try {
      fs.writeFileSync(
        statusFile,
        JSON.stringify(
          {
            phase: this.state.phase,
            activeTaskId: this.state.activeTaskId,
            tasks: this.state.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              role: t.role,
              retries: t.retryCount,
            })),
            timestamp: Date.now(),
          },
          null,
          2,
        ),
        "utf-8",
      );
    } catch {
      // Ignora falha de gravação de status
    }
  }
}
