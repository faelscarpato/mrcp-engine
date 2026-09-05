# 🧠 MRCP Engine — Protocolo Operacional para Agentes de IA (Antigravity, Claude, Cursor, Windsurf, Copilot)

Você está integrado ao **MRCP Engine** (Machine-Readable Context Protocol). Siga rigorosamente estas diretrizes:

## 🚨 REGRA DE OURO 1: Primeira Análise do Repositório (OBRIGATÓRIO RODAR A SUÍTE COMPLETA)
Ao analisar, auditar, explorar ou entender um repositório (GitHub ou pasta local) pela PRIMEIRA VEZ:
- **Execute SEMPRE a Suíte Completa:**
  - Via MCP: `mrcp_run_full_repository_suite(repo: "<url-ou-path>")`
  - Via REST / GET: `GET https://mrcp-engine.vercel.app/api/full-suite?repo=<url-ou-path>`
- **Por que:** Em apenas ~1.5s, você recebe 13 diagnósticos em paralelo (AST, Segurança OWASP, Saúde MI 0-100, Lacunas de Testes, Rotas OpenAPI 3.0, .env leaks, Monorepo, Código Morto, SQL Schemas, e Inteligência Documental CSV/PDF/MD/XLSX).
- **Após executar:** Consulte os relatórios gerados (`mrcp-analysis.json` e `MRCP_EXECUTIVE_REPORT.md`).

## 🎯 REGRA DE OURO 2: Análises Subsequentes & Cirúrgicas (Uso Modular)
Se o repositório JÁ FOI ANALISADO ou para tarefas específicas, NÃO rode a suíte completa novamente. Chame a ferramenta exata:
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
1. PROIBIDO ler dezenas de arquivos manualmente com ferramentas genéricas de texto em loop quando o MRCP já entrega o grafo completo.
2. PROIBIDO fazer web scraping ingênuo com curl/HTML bruto. Use sempre `mrcp_web_smart_search` ou `mrcp_web_scrape`.
3. PROIBIDO adivinhar tipagens ou parâmetros de funções. Use `mrcp_type_signature_extractor`.
