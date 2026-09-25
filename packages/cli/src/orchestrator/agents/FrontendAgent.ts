/**
 * MRCP Engine — FrontendAgent (MCP Native)
 *
 * Especialista em Interfaces, Componentes Reutilizáveis, Roteamento e Hooks.
 * Garante design responsivo, acessibilidade e isolamento da camada de apresentação.
 */

import { BaseAgent } from "../BaseAgent.js";
import { AgentRole, AgentTask } from "../types.js";

export class FrontendAgent extends BaseAgent {
  public readonly role: AgentRole = "FRONTEND";
  public readonly personaTitle: string = "MRCP Frontend & UI Architect";

  public readonly defaultSystemRules: string[] = [
    "Construa interfaces modulares dividindo componentes em apresentacionais e containers.",
    "Todo formulário deve possuir validação client-side antes do envio e feedback de carregamento.",
    "PROIBIDO acessar bancos de dados diretamente ou importar drivers SQL no frontend.",
    "Toda comunicação externa com APIs deve passar por clientes HTTP dedicados (ex: src/services/api ou hooks).",
    "Adote TypeScript estrito para todas as props de componentes e estados locais.",
    "Implemente acessibilidade básica (atributos ARIA, labels semânticos, navegação por teclado).",
    "Trate estados de erro, loading e estado vazio (empty state) em todas as telas principais.",
  ];

  protected getArchitecturalBoundaries(task: AgentTask): {
    allowedImports: string[];
    forbiddenImports: string[];
    guidelines: string[];
  } {
    return {
      allowedImports: [
        "react, react-dom, next, vue, svelte",
        "lucide-react, react-icons or equivalent UI icon sets",
        "tailwind, css modules, style systems",
        "state managers (zustand, redux-toolkit, jotai)",
        "form utilities (react-hook-form, zod)",
        "frontend api clients and DTO interfaces",
      ],
      forbiddenImports: [
        "pg, mysql2, mongodb, prisma, drizzle-orm or any database driver",
        "express, fastify or backend server internals",
        "node:fs, node:child_process or backend node system modules",
      ],
      guidelines: [
        "Prefira hooks reutilizáveis para lógica de estado complexa.",
        "Mantenha componentes com menos de 150 linhas; separe subcomponentes.",
        "Gere layouts responsivos (mobile-first com breakpoints consistentes).",
      ],
    };
  }

  protected override generateFileInitialStub(
    filePath: string,
    task: AgentTask,
  ): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const base = filePath.split(/[/\\]/).pop() || "Component";
    const componentName = base
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "");

    if (ext === "tsx" || ext === "jsx") {
      return `/**\n * ${base}\n * Componente UI: ${task.title}\n * Papel: Frontend Specialist\n */\n\nimport React from "react";\n\ninterface ${componentName}Props {\n  className?: string;\n}\n\nexport const ${componentName}: React.FC<${componentName}Props> = ({ className = "" }) => {\n  return (\n    <div className={className}>\n      {/* TODO: Implementar UI da tarefa ${task.title} */}\n    </div>\n  );\n};\n\nexport default ${componentName};\n`;
    }

    return `/**\n * ${base}\n * Módulo Frontend: ${task.title}\n */\n\n`;
  }
}
