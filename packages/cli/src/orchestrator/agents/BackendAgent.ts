/**
 * MRCP Engine — BackendAgent (MCP Native)
 *
 * Especialista em APIs, Controllers, Services, Regras de Negócio e Segurança de Endpoint.
 * Impõe separação estrita de camadas e validação de contratos de entrada e saída.
 */

import { BaseAgent } from "../BaseAgent.js";
import { AgentRole, AgentTask } from "../types.js";

export class BackendAgent extends BaseAgent {
  public readonly role: AgentRole = "BACKEND";
  public readonly personaTitle: string = "MRCP Backend & API Engineer";

  public readonly defaultSystemRules: string[] = [
    "Siga o princípio da separação de responsabilidades (Clean Architecture / Hexagonal).",
    "Controllers apenas recebem requisições, validam DTOs e delegam para Services.",
    "Services concentram as regras de negócio puras e utilizam a camada de dados/repositórios.",
    "PROIBIDO importar componentes de UI, React, DOM ou CSS nesta camada.",
    "Toda rota HTTP deve validar payloads de entrada com Zod ou schema equivalente.",
    "Sempre retorne respostas padronizadas com status HTTP semânticos (200, 201, 400, 404, 500).",
    "Trate erros de forma explícita com try/catch e middlewares de exceção.",
  ];

  protected getArchitecturalBoundaries(task: AgentTask): {
    allowedImports: string[];
    forbiddenImports: string[];
    guidelines: string[];
  } {
    return {
      allowedImports: [
        "node internal modules (http, crypto, fs, path, etc.)",
        "database layer and repositories",
        "validation packages (zod, joi)",
        "frameworks (express, fastify, nestjs, hono, etc.)",
        "security & auth libraries (bcrypt, jsonwebtoken, jose)",
      ],
      forbiddenImports: [
        "react, react-dom, @tanstack/react-query, vue, svelte",
        "css, tailwindcss, scss, style modules",
        "document, window or browser objects",
      ],
      guidelines: [
        "Rotas devem ser declaradas com métodos HTTP explícitos (GET, POST, PUT, DELETE).",
        "Evite funções gigantes (God Methods). Cada função deve realizar uma única tarefa clara.",
        "Não execute SQL raw diretamente em controllers; passe pelos repositórios tipados.",
      ],
    };
  }

  protected override generateFileInitialStub(
    filePath: string,
    task: AgentTask,
  ): string {
    const base = filePath.split(/[/\\]/).pop() || "module.ts";

    return `/**\n * ${base}\n * Módulo Backend: ${task.title}\n * Camada: Servidor / Regras de Negócio\n * Validação AST: MRCP Gatekeeper ATIVO\n */\n\nimport { z } from "zod";\n\n`;
  }
}
