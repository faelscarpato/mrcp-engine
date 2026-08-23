# 🧠 MRCP Engine — Protocolo Operacional para Agentes de IA (Antigravity, Claude, Cursor, Windsurf, Copilot)

Você está integrado ao **MRCP Engine** (Machine-Readable Context Protocol). Siga rigorosamente estas diretrizes para máxima performance e economia de até 92% de tokens:

## ⚡ REGRA DE OURO 1: Tarefas de Código, Refatoração e Features (MÁXIMA VELOCIDADE & ECONOMIA)
Para QUALQUER tarefa de implementação, edição de código, refatoração, correção de bugs ou criação de testes:
- **Execute SEMPRE o Context Pruning Pack:**
  - Via MCP: `mrcp_context_pruning_pack(taskDescription: "<descrição-da-tarefa>")`
  - Via REST / GET: `GET https://mrcp-engine.vercel.app/api/context-pack?repo=<url-ou-path>&task=<descrição>`
- **Por que:** Entrega os contratos, interfaces e trechos de código cirurgicamente podados (redução de 85% a 92% de tokens) em menos de 1 segundo, sem alucinações e sem estourar o contexto do modelo.

## 🛡️ REGRA DE OURO 2: Auditoria Completa 360° do Repositório (Health Check)
Quando o usuário solicitar explicitamente um diagnóstico geral, auditoria de arquitetura ou inspeção completa de conformidade:
- **Execute a Suíte Completa:**
  - Via MCP: `mrcp_run_full_repository_suite(repo: "<url-ou-path>")`
  - Via REST / GET: `GET https://mrcp-engine.vercel.app/api/full-suite?repo=<url-ou-path>`
- **Retorno Otimizado:** Retorna um Resumo Executivo em Markdown com todas as métricas-chave (Maintainability Index, OWASP, Test Gaps, OpenAPI, Monorepo, Código Morto) e salva o grafo completo em `mrcp-analysis.json`.

## 🎯 REGRA DE OURO 3: Análises Pontuais & Modulares
Para perguntas específicas, use a ferramenta cirúrgica adequada:
- Refatorar hotspot: `get_repository_skills_contract` & `mrcp_ast_refactor_applier`
- Impacto pré-commit (Blast Radius): `mrcp_impact_analysis`
- Segurança / Segredos: `mrcp_security_compliance_audit`
- Validar variáveis de ambiente: `mrcp_env_secret_contract_validator`
- Riscos e compatibilidade de pacotes: `mrcp_dependency_compatibility_resolver`
- Limpeza de exports órfãos: `mrcp_dead_code_pruner`
- Geração de testes unitários: `mrcp_auto_test_coverage_gap_finder`
- Consultar CSV, TXT, DOCX, XLSX, PDF, Log: `mrcp_document_analyzer`
- Extrair interfaces sem corpos: `mrcp_type_signature_extractor`
- Pesquisa e Scraping Web: `mrcp_web_smart_search` ou `mrcp_web_scrape`

## 🚫 ANTI-PADRÕES PROIBIDOS
1. PROIBIDO ler dezenas de arquivos manualmente com ferramentas genéricas de texto em loop quando o `mrcp_context_pruning_pack` já entrega o contexto podado.
2. PROIBIDO rodar `mrcp_run_full_repository_suite` para tarefas simples de código pontual.
3. PROIBIDO fazer web scraping ingênuo com curl/HTML bruto. Use sempre `mrcp_web_smart_search` ou `mrcp_web_scrape`.
4. PROIBIDO adivinhar tipagens ou parâmetros de funções. Use `mrcp_type_signature_extractor`.
