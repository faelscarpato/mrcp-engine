# 🧠 MRCP-Engine v2.2.0

**Machine-Readable Context Protocol Engine**

Motor de inteligência e terceirização de contexto estruturado que otimiza dados para consumo por LLMs e Agentes de IA (Antigravity, Claude, Cursor, Copilot, OpenCode, Ollama, etc.). Elimina o "AI Tax" — reduzindo drasticamente o desperdício de tokens através de parsing determinístico AST, refatorações em lote, extração de assinaturas de tipo, auditoria de segurança estática e extração web limpa.

---

## 🛠️ Lista Completa das 19 Ferramentas MCP / REST Endpoints

O MRCP-Engine expõe um total de **19 ferramentas MCP** e rotas REST serverless divididas em 5 categorias principais:

### 1. 🏗️ Core Engine (Análise Estrutural AST & Contratos)
* **`analyze_repository`** (`GET /api/analyze?repo=<url>`)
  * **Descrição:** Analisa o grafo estrutural AST de um repositório GitHub ou diretório local. Extrai nós (arquivos, módulos, funções), arestas (dependências), métricas de complexidade ciclomática, acoplamento e hotspots.
* **`get_repository_skills_contract`** (`GET /api/skills?repo=<url>`)
  * **Descrição:** Retorna contratos de habilidades e diretrizes de refatoração para arquivos classificados como hotspots (complexidade > 50), impondo *Zero Regression Policy* em assinaturas públicas.

---

### 2. ⚡ Terceirização de Alta Eficiência para Agentes IA (Novos Endpoints)
* **`mrcp_ast_refactor_applier`** (`POST /api/refactor-applier`)
  * **Descrição:** Aplica refatorações determinísticas em lote no AST (renomear símbolos, extrair interfaces, atualizar imports em dezenas de arquivos) em 30ms.
  * **Como a IA deve usar:** Deve ser chamada para aplicar alterações em lote sem precisar reescrever arquivos manualmente no LLM, economizando 98% dos tokens.
* **`mrcp_type_signature_extractor`** (`GET /api/type-signature-extractor?repo=<url>`)
  * **Descrição:** Extrai **apenas** as assinaturas de tipo TypeScript (`.d.ts`), schemas Zod e interfaces de arquivos, eliminando os corpos de código das funções.
  * **Como a IA deve usar:** Deve ser chamada antes de escrever chamadas para módulos internos para entender o contrato de tipos com apenas 50 tokens de contexto.
* **`mrcp_git_diff_semantic_summarizer`** (`POST /api/diff-summarizer`)
  * **Descrição:** Elimina ruídos de formatação/espaços de diffs e resume as alterações por domínio semântico no nível AST.
  * **Como a IA deve usar:** Usada durante revisões de PR/diff para analisar alterações de regras de negócio sem se perder no barulho de formatação.
* **`mrcp_dependency_compatibility_resolver`** (`GET /api/dependency-resolver?package=<nome>`)
  * **Descrição:** Resolve compatibilidade de versões SemVer, conflitos de dependências peer e riscos de breaking changes.
  * **Como a IA deve usar:** Usada antes de alterar `package.json` para evitar erros no terminal.
* **`mrcp_dead_code_pruner`** (`GET /api/dead-code-pruner?repo=<url>`)
  * **Descrição:** Análise de alcance por árvore AST para identificar exportações não utilizadas, variáveis mortas e imports sem uso.
  * **Como a IA deve usar:** Usada para limpeza automatizada do repositório em uma única chamada.
* **`mrcp_sql_schema_orm_contract_generator`** (`GET /api/sql-orm-contract?repo=<url>`)
  * **Descrição:** Analisa schemas Prisma, SQL DDL e ORMs (Drizzle/TypeORM) para expor tabelas e queries tipadas.
  * **Como a IA deve usar:** Usada ao escrever queries SQL/ORM para zerar alucinações de nomes de colunas e chaves estrangeiras.

---

### 3. 🛡️ Engenharia Preditiva & Segurança
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
