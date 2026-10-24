# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.7.6] - 2026-10-23

### Added

- VS Code extension: high-resolution PNG icon (`resources/mrcp-icon.png`) shown on the Visual Studio Marketplace and in the Extensions view. The Activity Bar keeps the vector SVG icon.
- VS Code extension: the MRCP Cockpit dashboard tab now shows the MRCP icon.

### Changed

- `README.md`, `README.pt-BR.md` and the VS Code extension README now describe the 40 supported Tree-sitter languages, and the extension install commands reference `mrcp-vscode-2.7.6.vsix`.

## [2.7.5] - 2026-10-23

### Added

- AST parsing for 24 more languages through bundled Tree-sitter WebAssembly grammars: ActionScript, AppleScript, AutoHotkey, AutoIt, Bicep, C#, CFML, InterSystems ObjectScript, Jenkins Pipeline (`Jenkinsfile`), Kotlin, Modelica, Natural, OpenSCAD, Pascal, Pawn, Q/KDB+, Salesforce Apex, SAS, Siemens SCL, Swift, VBA, Verse, VHDL, and Web3 (Vyper and Move).
- Language detection, import extraction and call extraction for the matching file extensions, such as `.cls`/`.trigger` (Apex), `.bas`/`.frm` (VBA), `.vhd`, `.vy`, `.move`, `.kts` and `.dpr`.
- VS Code extension: workspace analysis covers the same new file extensions, with symbol extractors for C#, Swift, Kotlin and Salesforce Apex that feed CodeLens and the dashboard.

### Fixed

- VS Code extension: the repository link in the extension manifest now points to `faelscarpato/mrcp-engine`.

## [2.7.3] - 2026-09-28

### Added

- Local analysis from the CLI: `npx mrcp-engine .` (or any local path) runs the full diagnostic suite on your machine with the compiled core and makes no remote requests. Add `--json` to write only the result to stdout. Other endpoints are rejected for local targets.
- The `analyze_repository` tool in the local MCP server accepts a local path and analyzes it locally instead of sending it to the hosted API. A new `raw` option returns compact JSON instead of the AI-formatted summary.
- `@mrcp/cli` package README covering programmatic use of the orchestration triad (`TechLeadOrchestrator`, `MrcpGatekeeper` and the specialist agents) and the `mrcp`, `mrcp-engine` and `mrcp-auto` binaries.
- Full-suite reports state which source produced the AST graph and flag synthetic graphs derived from the URL instead of the repository contents.

### Changed

- `/api/web-search`, `/api/scrape` and `/api/smart-search` now return structured errors: anti-bot blocks respond `429` with `retryable: true`, and upstream failures respond `502` with `retryable: false`. Both include `error_code` (`SEARCH_ANTI_BOT`, `SEARCH_UPSTREAM_ERROR`, `SCRAPE_ANTI_BOT` or `SCRAPE_UPSTREAM_ERROR`), `upstream_status` and the legacy `category: "SEARCH_BLOCKED"`. The `mrcp_web_search` and `mrcp_web_scrape` MCP tools return an error result instead of failing.
- Metrics that a step could not measure (Maintainability Index, grade, technical debt, security audit result, counts) are reported as `null` and shown as "not measured" instead of optimistic defaults such as 85/100, grade A or 15% debt. A security audit that inspected no file content is reported as inconclusive instead of passed.
- The MCP server, REST `/api/mcp` endpoint, terminal control panel, VS Code report provenance and exported reports read the engine version from `package.json` instead of hardcoded values (previously 2.5.0 or 2.6.x).
- The tree-sitter native grammar packages are now optional dependencies, and the published npm package ships compiled `dist/` output for `packages/core` and `packages/cli`.

### Fixed

- PDF text extraction decodes `/ToUnicode` CMaps, locates streams by their declared `/Length`, and discards image, font and inline-image data instead of returning it as text.
- `/api/report` and `/api/export-report` reuse a cached `mrcp-analysis.json` only when it belongs to the requested repository.

## [2.6.1] - 2026-09-24

### Added

- `mrcp_clone_page` MCP tool (PageCloner Pro) and the `/api/clone`, `/api/page-cloner` and `/api/page-prompt` REST endpoints: reverse-engineer a web page, by `url` or raw `html`, into design tokens, semantic components, a layout tree and a reconstruction prompt. Set `format` to `full`, `json` or `prompt`.
- Language detection and bundled Tree-sitter WebAssembly grammars for RPGLE, Pine Script, JCL, Power Query M, DAX, T-SQL, IEC 61131-3 Structured Text, MQL5, OpenEdge ABL, SAP ABAP and SAP CDS.
- Fallback extraction of SAP ABAP `METHOD` blocks and SAP CDS `DEFINE VIEW` entities as functions.
- Google Chrome extension (Manifest V3) in `mrcp-chrome-extension/`, with a prebuilt `mrcp-chrome-extension-v2.6.1.zip`: a side panel cockpit plus an "MRCP Cockpit" button injected into GitHub and GitLab repository headers.
- `POST /api/github/webhook` for GitHub App installations: verifies `X-Hub-Signature-256` against `GITHUB_WEBHOOK_SECRET` and analyzes the repository on every push.
- `POST /api/v2/cognitive/process` (MRCP Cognitive Runtime v2.1), authenticated with `Authorization: Bearer <MRCP_API_KEY>`: cleans Portuguese voice input, routes it to a deterministic fast path or a Gemini slow path (`GEMINI_API_KEY`), and returns text plus TTS-ready speech. `.env.example` lists the required variables.
- Privacy policy and terms of use pages on the hosted site.

### Fixed

- VS Code extension: duplicate module detection reports only modules with equivalent content and ignores intentional re-exports.

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
