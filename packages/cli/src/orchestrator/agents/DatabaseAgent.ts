/**
 * MRCP Engine — DatabaseAgent (MCP Native)
 *
 * Especialista em Modelagem de Dados, Schemas SQL, ORMs e Integridade Relacional.
 * Força a LLM da IDE a construir contratos de banco de dados isolados e robustos.
 */

import { BaseAgent } from "../BaseAgent.js";
import { AgentRole, AgentTask } from "../types.js";

export class DatabaseAgent extends BaseAgent {
  public readonly role: AgentRole = "DATABASE";
  public readonly personaTitle: string = "MRCP Database & Schema Architect";

  public readonly defaultSystemRules: string[] = [
    "Defina modelos de dados com chaves primárias UUID ou autoincrement determinísticas.",
    "Todo relacionamento relacional (1:N, N:N) deve ter chaves estrangeiras explícitas e índices de busca.",
    "Proibido incluir lógica de negócio, chamadas de rede ou interfaces visuais nos schemas de banco de dados.",
    "Garanta tipos estritos (TypeScript / SQL / Prisma / Drizzle) para todos os campos e enums.",
    "Nunca crie dependências circulares entre entidades de banco de dados.",
    "Sempre exporte os tipos derivados de cada entidade para que o Backend possa consumi-los com segurança de tipos.",
  ];

  protected getArchitecturalBoundaries(task: AgentTask): {
    allowedImports: string[];
    forbiddenImports: string[];
    guidelines: string[];
  } {
    return {
      allowedImports: [
        "orm libraries (prisma, drizzle-orm, typeorm, pg, etc.)",
        "validation libraries (zod, valibot, yup)",
        "internal domain types within database/schema layer",
      ],
      forbiddenImports: [
        "react, vue, svelte or any frontend/UI packages",
        "express, fastify, nest controllers or HTTP handlers",
        "browser APIs or DOM APIs",
      ],
      guidelines: [
        "Mantenha os schemas no diretório específico de persistência (ex: src/db/ ou src/models/).",
        "Centralize a conexão do client em um único singleton para evitar conexões órfãs.",
        "Disponibilize migrações reproduzíveis ou scripts de DDL limpos.",
      ],
    };
  }

  protected override generateFileInitialStub(
    filePath: string,
    task: AgentTask,
  ): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const base = filePath.split(/[/\\]/).pop() || "schema";

    if (ext === "prisma") {
      return `// Prisma Schema\n// Tarefa: [${task.id}] ${task.title}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\n// Defina os modelos abaixo\n`;
    }

    if (ext === "sql") {
      return `-- SQL Migration / DDL\n-- Tarefa: [${task.id}] ${task.title}\n\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n`;
    }

    return `/**\n * ${base}\n * Modelagem de dados para: ${task.title}\n * Camada: Database / Persistência\n */\n\nimport { z } from "zod";\n\n`;
  }
}
