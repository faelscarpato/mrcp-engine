# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.7.1] - 2026-09-24

### Added

- **A Tríade de Orquestração Autônoma (MCP Native):**
  - `TechLeadOrchestrator`: Cérebro orquestrador com pesquisa autônoma na Web via DuckDuckGo/Scraper e decomposição em grafo de tarefas com contratos formais (`AgentTasks`).
  - `MrcpGatekeeper`: Medula espinhal e QA em tempo real com File System Watcher contínuo, validação AST imediata (detecção de ciclos `ARCH-CYCLIC-001`, deriva arquitetural `ARCH-LAYER-002`, e God Modules), com loop de auto-correção via `.mrcp/GATEKEEPER_CRITIQUE.md`.
  - `AgentManager` & Agentes Especialistas: `DatabaseAgent`, `BackendAgent` e `FrontendAgent`, com empacotamento de diretivas MCP (`ACTIVE_PROMPT_DIRECTIVE.md`) e zero chamadas LLM internas.
  - CLI autônomo: comando `npx mrcp-engine auto "<prompt>"` e binário dedicado `mrcp-auto`.
  - Integração nativa na extensão VS Code (`apps/vscode`): novo comando `mrcp.startAutonomous` e item no menu de Ações Rápidas.
  - Documentação técnica e de arquitetura completa em `TRIADE_ORQUESTRACAO_AUTONOMA.md` e `docs/ORCHESTRATOR_ARCHITECTURE_AND_SPECS.md`.

### Fixed

- Inclusão dos diretórios `packages/` e `api/` no campo `"files"` do `package.json` para garantir que o tarball publicado no NPM contenha todos os módulos de execução necessários para o `npx`.
- Carregamento dinâmico resiliente do `cheerio` com fallback nativo via expressões regulares em `scraper-tools.ts`.

## [2.6.0] - 2026

### Added

- Full 13-tool diagnostic suite (`mrcp_run_full_repository_suite`) with parallel execution and consolidated executive report
- Document intelligence for non-code repositories (`mrcp_document_analyzer`) — CSV, TSV, TXT, MD, DOCX, XLSX, XLS, PDF, JSON, YAML, XML, LOG
- Native VS Code / Cursor / Windsurf extension (`apps/vscode`) with sidebar, MRCP Cockpit dashboard, inline CodeLens, and AI Context Packer
- `npx mrcp-engine setup` — one-command auto-configuration across 10 IDEs/AI clients
- Web search & scraping tool set (`mrcp_web_search`, `mrcp_web_scrape`, `mrcp_web_smart_search`)
- Résumé/HR triage tool set (`mrcp_triage_parse_resume`, `mrcp_triage_score_candidate`, `mrcp_triage_generate_hr_report`)

### Notes

This entry reconstructs the 2.6.0 feature set from the current codebase and README; earlier version history (1.0.0 → 2.6.0) predates this changelog and isn't itemized here. From this point forward, every release should add an entry above.

---

## How to add an entry

When you cut a release:

1. Rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` and add a fresh empty `[Unreleased]` above it.
2. Group changes under `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, or `Security`.
3. One line per change, written for a user of the package — not a raw commit message.
