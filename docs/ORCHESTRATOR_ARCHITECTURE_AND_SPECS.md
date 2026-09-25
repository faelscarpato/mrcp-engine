# 🏛️ Especificação Técnica & Arquitetura: Tríade de Orquestração Autônoma

**Versão da Implementação:** `2.7.1`  
**Módulo:** `@mrcp/cli/orchestrator` & `mrcp-engine auto`  
**Padrão:** MCP Native (Zero LLM Interno / Condução de IA da IDE)  
**Status:** Produção / Validado com Vitest & ESLint  

---

## 1. Sumário Executivo

A versão `2.7.1` do **MRCP Engine** introduz uma camada superior de **Engenharia de Software Autônoma**. Em vez de tratar a inteligência artificial como uma caixa-preta que gera código sem supervisão estrutural, o sistema implementa a **Tríade de Orquestração Autônoma**:

1. **O Cérebro (TechLeadOrchestrator):** Pesquisa referências na Web de forma autônoma (DuckDuckGo + Web Scraper embutidos), projeta a arquitetura modular e decompõe o objetivo em contratos formais de tarefas (`AgentTasks`).
2. **O Executor (AgentManager + Agentes Especialistas):** Gerencia trabalhadores especializados em Banco de Dados (`DatabaseAgent`), Backend (`BackendAgent`) e Frontend (`FrontendAgent`), empacotando contexto estrito e diretivas MCP (`ACTIVE_PROMPT_DIRECTIVE.md`) para que a LLM da IDE execute com máxima precisão.
3. **A Medula Espinhal / QA (MrcpGatekeeper):** Observa o File System em tempo real através de um Watcher dedicado e intercepta qualquer mutação de código. Executa o motor AST determinístico do MRCP para validar complexidade ciclomática, dependências circulares e violação de camadas. Se o código violar contratos, o Gatekeeper bloqueia o avanço e força a LLM da IDE a corrigir (`GATEKEEPER_CRITIQUE.md`); quando 100% conforme, emite certificação (`GATEKEEPER_APPROVAL.md`) e libera o próximo passo.

---

## 2. Paradigma "MCP Native" (Zero LLM Interno)

### 2.1. Por que não usar chamadas de LLM internas no MRCP?
- **Custo e Autenticação:** Exigir `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` ou `GEMINI_API_KEY` dentro da biblioteca do CLI cria atrito de adoção, custos duplicados e expõe segredos.
- **Aproveitamento da IDE:** O desenvolvedor moderno já utiliza ambientes inteligentes (Antigravity CLI/IDE, Cursor, Claude Desktop, Windsurf) que possuem modelos de ponta ativos.
- **Divisão de Responsabilidades:** O MRCP Engine fornece **diretivas estruturais, governança matemática e inspeção de código**. A LLM da IDE fornece a **geração criativa de sintaxe**. O Gatekeeper garante que a criatividade não quebre a arquitetura.

---

## 3. Arquitetura dos Módulos

```
packages/cli/src/orchestrator/
├── types.ts                    # Contratos de tipos, payloads JSON e interfaces
├── BaseAgent.ts                # Classe base abstrata para agentes com suporte MCP
├── AgentManager.ts             # Pool de agentes e gerador de diretivas ativas (.mrcp/)
├── TechLeadOrchestrator.ts      # Planejador, motor de pesquisa web e gestor de tarefas
├── MrcpGatekeeper.ts           # Observador do FS e inspetor AST em tempo real
├── index.ts                    # Ponto único de exportação do módulo
├── orchestrator.test.ts        # Testes unitários com Vitest
└── agents/
    ├── DatabaseAgent.ts        # Especialista em schemas, ORMs e isolamento relacional
    ├── BackendAgent.ts         # Especialista em APIs HTTP, controllers e regras de negócio
    └── FrontendAgent.ts        # Especialista em componentes visuais, hooks e DTOs
```

### 3.1. `types.ts`
Define os contratos fundamentais:
```typescript
export type AgentRole = "TECH_LEAD" | "FRONTEND" | "BACKEND" | "DATABASE" | "QA_GATEKEEPER";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "VALIDATING" | "APPROVED" | "REJECTED" | "FAILED";

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  role: AgentRole;
  targetFiles: string[];
  architecturalRules: string[];
  constraints?: ArchitecturalConstraint;
  dependencies: string[];
  status: TaskStatus;
  assignedAgent: string;
  contextPayload?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
}
```

### 3.2. `TechLeadOrchestrator.ts`
Implementa o fluxo de planejamento autônomo:
- `conductResearch()`: Extrai palavras-chave do domínio e consulta a Web via DuckDuckGo HTML scraping e parser de tags `<h1>..<h3>`.
- `planArchitecture()`: Gera o grafo sequencial de tarefas:
  1. `TASK-DB-001` (Database)
  2. `TASK-BACKEND-002` (Backend - depende de DB)
  3. `TASK-FRONTEND-003` (Frontend - depende de Backend)
- Grava os arquivos master em `.mrcp/ARCHITECTURE_PLAN.json` e `.mrcp/ARCHITECTURE_PLAN.md`.

### 3.3. `MrcpGatekeeper.ts`
O validador em tempo real do sistema:
- **Watcher do File System:** Usa `chokidar` (ou `fs.watch` recursivo nativo no Windows/macOS) com debounce de 800ms.
- **Validações AST executadas em paralelo:**
  1. `detectArchitectureDrift`:
     - `ARCH-CYCLIC-001`: Detecta se módulo A importa B e B importa A direta ou indiretamente.
     - `ARCH-LAYER-002`: Detecta se camadas de domínio/core importam infraestrutura ou UI.
  2. `calculateCodeHealth`:
     - `COMPLEXITY-GOD-MODULE`: Detecta funções ou classes com complexidade ciclomática $> 60$.
  3. **Restrições de Domínio de Tarefa:**
     - `ARCH-NO-FRONTEND-IN-BACKEND`: Impede que backend/database importe React/DOM.
     - `ARCH-NO-DATABASE-IN-FRONTEND`: Impede que frontend conecte direto ao banco de dados.

---

## 4. Estrutura dos Artefatos de Comunicação (`.mrcp/`)

A pasta `.mrcp/` criada na raiz do projeto gerado funciona como a memória compartilhada e canal de controle entre o CLI e a IA da IDE:

```
<projeto-alvo>/.mrcp/
├── ARCHITECTURE_PLAN.json         # Especificação formal da arquitetura
├── ARCHITECTURE_PLAN.md           # Visualização em Markdown para o desenvolvedor
├── active_mission.json            # Estado da tarefa atual em execução
├── ACTIVE_PROMPT_DIRECTIVE.md     # Instrução imperativa para a LLM da IDE ler e agir
├── GATEKEEPER_CRITIQUE.md         # Gerado em falhas: aponta violações AST e correção exigida
├── GATEKEEPER_APPROVAL.md         # Gerado em aprovação: certificação de conformidade
└── mission_status.json            # Histórico e estado em tempo real da máquina de tarefas
```

---

## 5. Como a LLM da IDE (Antigravity / Cursor / Claude) Executa a Missão

1. O CLI imprime no terminal o caminho da diretiva ativa:
   `📄 Diretiva gravada em: .mrcp/ACTIVE_PROMPT_DIRECTIVE.md`
2. A LLM da IDE lê o arquivo `.mrcp/ACTIVE_PROMPT_DIRECTIVE.md` e adota a persona indicada.
3. A LLM escreve o código completo nos arquivos indicados em `targetFiles`.
4. O salvamento dos arquivos dispara imediatamente o evento do Watcher no `MrcpGatekeeper`.
5. O Gatekeeper valida o grafo de sintaxe abstrata:
   - Se rejeitado: Atualiza `GATEKEEPER_CRITIQUE.md` e o orquestrador incrementa a tentativa de auto-correção.
   - Se aprovado: Atualiza `GATEKEEPER_APPROVAL.md`, avança a tarefa para `APPROVED` e ativa a próxima tarefa da fila.

---

## 6. Integração com a Extensão do VS Code (`apps/vscode`)

A extensão do VS Code foi atualizada na versão `2.7.1`:
- **Comando:** `mrcp.startAutonomous` (*"MRCP: Iniciar Orquestrador Autônomo (Tech Lead)"*)
- **Ação Rápida:** Item adicionado ao topo do menu de ações rápidas no painel lateral.
- **Comportamento:** Ao clicar ou executar o comando, o VS Code abre um input box para receber o prompt macro e inicia o terminal dedicado *"MRCP Autonomous"* rodando `npx mrcp-engine auto "<prompt>"`.

---

## 7. Comandos de Operação

### Execução via NPX (Sem Instalação Prévia)
```bash
# Execução direta com prompt
npx mrcp-engine auto "Crie um SaaS de clínicas médicas com prontuário e agendamento"

# Definindo pasta personalizada de destino
npx mrcp-engine auto "Construa uma API de pagamentos com webhook e conciliação" --dir ./pagamentos-app

# Usando o atalho dedicado
npx mrcp-auto "Sistema de controle de estoque com Next.js e Prisma"
```

### Execução de Testes do Módulo
```bash
pnpm vitest run packages/cli/src/orchestrator/orchestrator.test.ts
```

### Checagem de Linter e Tipos
```bash
pnpm run lint
pnpm exec tsc --noEmit
```
