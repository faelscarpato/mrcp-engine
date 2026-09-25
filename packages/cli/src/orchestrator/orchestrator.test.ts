/**
 * Testes Unitários da Tríade de Orquestração Autônoma (MCP Native)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  TechLeadOrchestrator,
  AgentManager,
  MrcpGatekeeper,
  DatabaseAgent,
  BackendAgent,
  FrontendAgent,
} from "./index.js";

const TEST_DIR = path.resolve(process.cwd(), "test-workspace-triad");

describe("Tríade de Orquestração Autônoma (MRCP Engine)", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("TechLeadOrchestrator", () => {
    it("deve decompor o objetivo macro em tarefas de Database, Backend e Frontend", async () => {
      const orchestrator = new TechLeadOrchestrator(
        "SaaS de Clínicas Médicas",
        TEST_DIR,
      );

      await orchestrator.initializeWorkspace();
      const plan = await orchestrator.planArchitecture([]);

      expect(plan.projectName).toContain("clinicas-medicas");
      expect(plan.tasks.length).toBe(3);

      const dbTask = plan.tasks.find((t) => t.role === "DATABASE");
      const backendTask = plan.tasks.find((t) => t.role === "BACKEND");
      const frontendTask = plan.tasks.find((t) => t.role === "FRONTEND");

      expect(dbTask).toBeDefined();
      expect(backendTask).toBeDefined();
      expect(frontendTask).toBeDefined();

      // Dependências estritas
      expect(backendTask?.dependencies).toContain(dbTask?.id);
      expect(frontendTask?.dependencies).toContain(backendTask?.id);

      // Verifica arquivos gerados em .mrcp
      const planMdPath = path.join(TEST_DIR, ".mrcp", "ARCHITECTURE_PLAN.md");
      expect(fs.existsSync(planMdPath)).toBe(true);
    });

    it("deve selecionar a primeira tarefa pendente e despachá-la", async () => {
      const orchestrator = new TechLeadOrchestrator(
        "API de Pagamentos",
        TEST_DIR,
      );
      await orchestrator.initializeWorkspace();
      await orchestrator.planArchitecture([]);

      const firstTask = orchestrator.getNextPendingTask();
      expect(firstTask).not.toBeNull();
      expect(firstTask?.role).toBe("DATABASE");

      orchestrator.dispatchTask(firstTask!);
      expect(orchestrator.getState().activeTaskId).toBe(firstTask?.id);
      expect(orchestrator.getState().phase).toBe("WAITING_IDE_LLM");

      // Deve ter gerado a diretiva MCP no disco
      const directivePath = path.join(
        TEST_DIR,
        ".mrcp",
        "ACTIVE_PROMPT_DIRECTIVE.md",
      );
      expect(fs.existsSync(directivePath)).toBe(true);

      const directiveContent = fs.readFileSync(directivePath, "utf-8");
      expect(directiveContent).toContain("MRCP Database & Schema Architect");
    });
  });

  describe("AgentManager & Agentes Especialistas", () => {
    it("deve registrar os três especialistas e preparar stubs de arquivos", () => {
      const manager = new AgentManager(TEST_DIR);
      const registered = manager.listRegisteredAgents();

      expect(registered.length).toBe(3);
      expect(registered.some((a) => a.role === "DATABASE")).toBe(true);
      expect(registered.some((a) => a.role === "BACKEND")).toBe(true);
      expect(registered.some((a) => a.role === "FRONTEND")).toBe(true);

      const task = {
        id: "TASK-TEST-001",
        title: "Modelagem Teste",
        description: "Teste de preparação",
        role: "DATABASE" as const,
        targetFiles: ["src/db/schema.prisma"],
        architecturalRules: ["Sem dependências circulares"],
        dependencies: [],
        status: "PENDING" as const,
        assignedAgent: "MRCP Database & Schema Architect",
        retryCount: 0,
        maxRetries: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const directive = manager.activateTask(task);
      expect(directive.role).toBe("DATABASE");
      expect(
        fs.existsSync(path.join(TEST_DIR, "src", "db", "schema.prisma")),
      ).toBe(true);
    });
  });

  describe("MrcpGatekeeper", () => {
    it("deve rejeitar violação de camada (Backend importando React)", async () => {
      const orchestrator = new TechLeadOrchestrator("App Teste QA", TEST_DIR);
      await orchestrator.initializeWorkspace();
      const plan = await orchestrator.planArchitecture([]);

      const backendTask = plan.tasks.find((t) => t.role === "BACKEND")!;
      orchestrator.dispatchTask(backendTask);

      // Simula escrita proibida da LLM da IDE
      const badFilePath = path.join(
        TEST_DIR,
        "src/server/services/app-service.ts",
      );
      fs.mkdirSync(path.dirname(badFilePath), { recursive: true });
      fs.writeFileSync(
        badFilePath,
        'import React from "react";\nexport function doSomething() { return "bad"; }\n',
        "utf-8",
      );

      const gatekeeper = new MrcpGatekeeper({
        targetDirectory: TEST_DIR,
        orchestrator,
      });

      const validation = await gatekeeper.validateWorkspace(
        "TEST",
        badFilePath,
      );

      expect(validation.isValid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(
        validation.violations.some(
          (v) => v.ruleId === "ARCH-NO-FRONTEND-IN-BACKEND",
        ),
      ).toBe(true);

      // Deve ter gerado o arquivo de crítica no disco
      const critiquePath = path.join(
        TEST_DIR,
        ".mrcp",
        "GATEKEEPER_CRITIQUE.md",
      );
      expect(fs.existsSync(critiquePath)).toBe(true);
    });

    it("deve aprovar código limpo sem violações de arquitetura", async () => {
      const orchestrator = new TechLeadOrchestrator(
        "App Teste Limpo",
        TEST_DIR,
      );
      await orchestrator.initializeWorkspace();
      const plan = await orchestrator.planArchitecture([]);

      const dbTask = plan.tasks.find((t) => t.role === "DATABASE")!;
      orchestrator.dispatchTask(dbTask);

      // Escreve código limpo e sem violações
      const cleanFile = path.join(TEST_DIR, "src/db/entities.ts");
      fs.mkdirSync(path.dirname(cleanFile), { recursive: true });
      fs.writeFileSync(
        cleanFile,
        "export interface UserEntity {\n  id: string;\n  name: string;\n  createdAt: Date;\n}\n",
        "utf-8",
      );

      const gatekeeper = new MrcpGatekeeper({
        targetDirectory: TEST_DIR,
        orchestrator,
      });

      const validation = await gatekeeper.validateWorkspace("TEST", cleanFile);

      expect(validation.isValid).toBe(true);
      expect(validation.violations.length).toBe(0);

      // Deve ter gerado o arquivo de aprovação no disco
      const approvalPath = path.join(
        TEST_DIR,
        ".mrcp",
        "GATEKEEPER_APPROVAL.md",
      );
      expect(fs.existsSync(approvalPath)).toBe(true);
    });
  });
});
