# 🧠 MRCP-Engine v2.5.0

**Machine-Readable Context Protocol Engine**

Motor de inteligência e terceirização de contexto estruturado que otimiza dados para consumo por LLMs e Agentes de IA (Antigravity, Claude, Cursor, Copilot, OpenCode, Ollama, etc.). Elimina o "AI Tax" — reduzindo drasticamente o desperdício de tokens através de parsing determinístico AST de código e **Inteligência Documental para repositórios não-código** (CSV, TSV, TXT, MD, DOCX, XLSX, XLS, PDF, JSON, YAML, XML, LOG).

---

## 🎯 Dois Modos de Operação (Flexibilidade Total para IAs e Desenvolvedores)

O MRCP-Engine oferece **2 modos de consumo**:

1. **⚡ Modo Modular (Sob Demanda):** A IA ou usuário chama exatamente a ferramenta que precisa (ex: `mrcp_document_analyzer`, `mrcp_api_contract_generator` ou `mrcp_security_compliance_audit`), economizando tempo e focando em uma tarefa isolada.
2. **🚀 Modo Diagnóstico Completo (All-in-One Pipeline - `GET /api/full-analysis` ou `mrcp_run_full_repository_suite`):** A IA ou usuário dispara **uma única chamada** que executa automaticamente as 13 ferramentas de análise de código e documentos em paralelo assíncrono. Cada relatório intermediário é gravado em tempo real em `mrcp-analysis.json` e um painel executivo consolidado (`MRCP_EXECUTIVE_REPORT.md`) é retornado.

---

## 🛠️ Lista Completa das Ferramentas MCP / REST Endpoints

### 1. 🏗️ Core Engine & Inteligência Documental
* **`analyze_repository`** (`GET /api/analyze?repo=<url>`)
  * **Descrição:** Analisa o grafo estrutural AST de um repositório GitHub ou diretório local. Extrai nós (arquivos, módulos, funções), arestas (dependências), métricas de complexidade ciclomática, acoplamento e hotspots.
* **`mrcp_document_analyzer`** (`GET /api/document-analyzer?repo=<url>`) **(NOVO v2.5.0)**
  * **Descrição:** Analisador determinístico para **repositórios documentais / não-código**. Realiza parsing de arquivos **CSV, TSV, TXT, MD, DOCX, XLSX, XLS, PDF (camada de texto vetorial), JSON, YAML, XML e LOG**. Gera Grafo de Conhecimento, inferência de schemas tabulares com interfaces TypeScript, cálculo do Document Quality Index (DQI 0-100), detecção de links quebrados e diretivas de contexto para LLMs sem OCR.
* **`get_repository_skills_contract`** (`GET /api/skills?repo=<url>`)
  * **Descrição:** Retorna contratos de habilidades e diretrizes de refatoração para arquivos classificados como hotspots (complexidade > 50), impondo *Zero Regression Policy* em assinaturas públicas.
* **`mrcp_run_full_repository_suite`** (`GET /api/full-suite?repo=<url>`)
  * **Descrição:** Executa a suíte diagnóstica completa de 13 ferramentas em paralelo ultrarrápido (~1.5s) e grava o dashboard executivo.

---

### 2. ⚡ Terceirização de Alta Eficiência para Agentes IA
* **`mrcp_api_contract_generator`** (`GET /api/api-contract?repo=<url>`) **(NOVO v2.3)**
  * **Descrição:** Extrai rotas e handlers de API (Next.js, Express, Fastify, Hono, FastAPI, Flask) e gera especificações OpenAPI 3.0.3 e SDKs TypeScript tipados sem alucinações.
* **`mrcp_monorepo_package_graph_analyzer`** (`GET /api/monorepo-graph?repo=<url>`) **(NOVO v2.3)**
  * **Descrição:** Mapeia topologia de monorepos (pnpm, turborepo, lerna, nx), dependências entre pacotes, ordem topológica de build em fases e pacotes afetados por diffs.
* **`mrcp_docstring_api_doc_generator`** (`GET /api/doc-generator?repo=<url>`) **(NOVO v2.3)**
  * **Descrição:** Gera anotações TSDoc, JSDoc ou Python Docstrings e tabelas Markdown de referência de API para símbolos públicos não documentados.
* **`mrcp_ast_refactor_applier`** (`POST /api/refactor-applier`)
  * **Descrição:** Aplica refatorações determinísticas em lote no AST (renomear símbolos, extrair interfaces, atualizar imports em dezenas de arquivos) em 30ms.
* **`mrcp_type_signature_extractor`** (`GET /api/type-signature-extractor?repo=<url>`)
  * **Descrição:** Extrai **apenas** as assinaturas de tipo TypeScript (`.d.ts`), schemas Zod e interfaces de arquivos, eliminando os corpos de código das funções (redução de 3.000 para 50 tokens).
* **`mrcp_git_diff_semantic_summarizer`** (`POST /api/diff-summarizer`)
  * **Descrição:** Elimina ruídos de formatação/espaços de diffs e resume as alterações por domínio semântico no nível AST.
* **`mrcp_dependency_compatibility_resolver`** (`GET /api/dependency-resolver?package=<nome>`)
  * **Descrição:** Resolve compatibilidade de versões SemVer, conflitos de dependências peer e riscos de breaking changes contra o NPM Registry real.
* **`mrcp_dead_code_pruner`** (`GET /api/dead-code-pruner?repo=<url>`)
  * **Descrição:** Análise de alcance por árvore AST para identificar exportações não utilizadas, variáveis mortas e imports sem uso.
* **`mrcp_sql_schema_orm_contract_generator`** (`GET /api/sql-orm-contract?repo=<url>`)
  * **Descrição:** Analisa schemas Prisma, SQL DDL e ORMs (Drizzle/TypeORM) para expor tabelas e queries tipadas.

---

### 3. 🛡️ Engenharia Preditiva & Segurança
* **`mrcp_code_metrics_health_scorer`** (`GET /api/code-health?repo=<url>`) **(NOVO v2.3)**
  * **Descrição:** Calcula o Índice de Manutenibilidade (MI 0-100), nota de débitos técnicos (A-F), distribuição de carga cognitiva e top 5 hotspots de refatoração com estimativa de esforço.
* **`mrcp_env_secret_contract_validator`** (`GET /api/env-validator?repo=<url>`) **(NOVO v2.3)**
  * **Descrição:** Mapeia variáveis de ambiente no código (`process.env`, `os.environ`), audita contra `.env.example`, detecta riscos de vazamento em bundles públicos e gera schemas de validação Zod.
* **`mrcp_impact_analysis`** (`POST /api/impact-analysis`)
  * **Descrição:** Calcula o **Raio de Impacto de Alterações (*AST Blast Radius*)** e mapeia arquivos/testes afetados a jusante.
* **`mrcp_security_compliance_audit`** (`GET /api/security-audit?repo=<url>`)
  * **Descrição:** Auditoria estática de segurança AST (OWASP, segredos hardcoded, execução insegura de shell, dependências vulneráveis e licenças GPL).
* **`mrcp_architectural_drift_detector`** (`GET /api/architecture-drift?repo=<url>`)
  * **Descrição:** Detecta desvios arquiteturais, ciclos de dependência (Tarjan) e violações de Clean Architecture.
* **`mrcp_auto_test_coverage_gap_finder`** (`GET /api/test-gap-analysis?repo=<url>`)
  * **Descrição:** Mapeia funções de alta complexidade sem cobertura e gera stubs automatizados em Vitest/Jest.
* **`mrcp_context_pruning_pack`** (`GET /api/context-pack?repo=<url>&task=<desc>`)
  * **Descrição:** Fatiamento de contexto AST baseado na tarefa do usuário com 60-90% de economia de tokens.

---

### 4. 🌐 Web Scraper & Search (Extração Web Inteligente)
* **`mrcp_web_search`** (`GET /api/web-search?q=<query>`): Pesquisa rápida na web.
* **`mrcp_web_scrape`** (`GET /api/scrape?url=<url>`): Extração de texto limpo sem anúncios.
* **`mrcp_web_smart_search`** (`GET /api/smart-search?q=<query>&topN=2`): Busca e extração profunda `topN`.

---

### 5. 👥 Triage & HR (Triagem & Recrutamento Determinístico)
* **`mrcp_triage_parse_resume`**: Parse determinístico de currículos.
* **`mrcp_triage_score_candidate`**: Match score vaga vs. candidato.
* **`mrcp_triage_generate_hr_report`**: Parecer técnico formatado para RH.

---

## 💾 Salvamento Automático dos Resultados (`mrcp-analysis.json`)

Sempre que **QUALQUER** endpoint ou ferramenta MCP é executada (via REST ou via MCP), o MRCP-Engine grava automaticamente o resultado em um arquivo centralizado de auditoria chamado **`mrcp-analysis.json`** na raiz do projeto.

---

## 🌐 Como Usar Sem MCP (Modo REST API Direto)

Se a sua IA ou agente não suportar o protocolo MCP, você pode realizar chamadas HTTP `GET` ou `POST` diretas:

| Endpoint | Método | Descrição |
| --- | --- | --- |
| `/api/analyze?repo=<url>` | `GET` | Grafo AST e métricas de complexidade |
| `/api/skills?repo=<url>` | `GET` | Contratos de refatoração para hotspots |
| `/api/api-contract?repo=<url>` | `GET` | Extração de rotas, OpenAPI 3.0 e SDK TypeScript |
| `/api/code-health?repo=<url>` | `GET` | Índice de Manutenibilidade (MI) e Débito Técnico |
| `/api/env-validator?repo=<url>` | `GET` | Validação de `.env`, alertas de vazamento e schema Zod |
| `/api/monorepo-graph?repo=<url>` | `GET` | Grafo de dependências entre pacotes e ordem de build |
| `/api/doc-generator?repo=<url>` | `GET` | Gerador determinístico de JSDoc/TSDoc e API Reference |
| `/api/refactor-applier` | `POST` | Aplicação de refatorações AST em lote |
| `/api/type-signature-extractor?repo=<url>` | `GET` | Extração de assinaturas de tipo |
| `/api/diff-summarizer` | `POST` | Resumo semântico de Git Diff |
| `/api/dependency-resolver?package=<nome>` | `GET` | Resolução de versão e compatibilidade de dependências |
| `/api/dead-code-pruner?repo=<url>` | `GET` | Detecção de código morto por árvore AST |
| `/api/sql-orm-contract?repo=<url>` | `GET` | Contratos tipados de banco de dados e ORM |
| `/api/impact-analysis` | `POST` | Raio de impacto (`body: { repoUrl, modifiedFiles }`) |
| `/api/security-audit?repo=<url>` | `GET` | Auditoria estática de segurança e licenças |
| `/api/architecture-drift?repo=<url>` | `GET` | Detecção de desvios de arquitetura |
| `/api/test-gap-analysis?repo=<url>` | `GET` | Identificação de lacunas de teste e stubs |
| `/api/context-pack?repo=<url>&task=<desc>` | `GET` | Pacote de contexto fatiado para LLMs |
| `/api/mcp` | `POST` | Endpoint central MCP (JSON-RPC 2.0) |

---

## 🤖 Como Instalar o MCP nas LLMs e Plataformas de IA

### 1. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "mrcp-engine": {
      "command": "npx",
      "args": ["-y", "mrcp-engine@latest"]
    }
  }
}
```

### 2. Antigravity / Cursor / Windsurf / VS Code (Servidor HTTP Remoto)
```json
{
  "mcpServers": {
    "mrcp-engine": {
      "url": "https://mrcp-engine.vercel.app/api/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## 📄 Licença

MIT
