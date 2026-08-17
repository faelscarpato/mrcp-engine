# 🧠 MRCP-Engine

**Machine-Readable Context Protocol Engine**

Motor de inteligência e contexto estruturado que otimiza dados para consumo por LLMs e agentes de IA. Elimina o "AI Tax" — reduzindo drasticamente o desperdício de tokens através de parsing determinístico, grafos de dependência AST, extração web limpa e triagem automatizada.

---

## 🛠️ Módulos e Ferramentas Disponíveis

O MRCP-Engine expõe um conjunto de ferramentas divididas em três categorias principais:

### 1. 🏗️ Core Engine (Análise de Repositórios & AST)
Otimizado para análise arquitetural de código-fonte sem necessidade de enviar arquivos inteiros para o LLM.

* **`analyze_repository`**: Analisa o grafo estrutural AST de um repositório GitHub. Extrai nós (arquivos, módulos, funções), arestas (dependências), métricas de complexidade ciclomática, acoplamento e hotspots arquiteturais.
* **`get_repository_skills_contract`**: Gera contratos de habilidades e diretrizes acionáveis de refatoração para arquivos classificados como hotspots, definindo regras estritas de blindagem de dependências e limites de complexidade.

---

### 2. 🌐 Web Scraper & Search (Extração Web Inteligente)
Ferramentas de navegação e extração com foco em texto limpo e baixo consumo de contexto.

* **`mrcp_web_search`**: Pesquisa rápida na web retornando títulos, URLs e snippets relevantes.
* **`mrcp_web_scrape`**: Raspa uma URL específica e extrai apenas o conteúdo textual limpo, eliminando tags de navegação, scripts, anúncios e boilerplate HTML.
* **`mrcp_web_smart_search`**: Orquestrador de busca profunda que pesquisa, ranqueia os resultados mais relevantes por pontuação de palavras-chave e já extrai o texto integral das páginas principais (`topN`).

---

### 3. 👥 Triage & HR (Triagem & Recrutamento Determinístico)
Pipeline de processamento e avaliação de candidatos focado em baixo custo computacional.

* **`mrcp_triage_parse_resume`**: Extrai de forma determinística nome, e-mail e lista de habilidades técnicas de currículos em texto bruto via regex/parsing sem consumo desnecessário de tokens.
* **`mrcp_triage_score_candidate`**: Calcula o percentual de aderência (match score) entre o perfil do candidato e os requisitos da vaga utilizando teoria de conjuntos.
* **`mrcp_triage_generate_hr_report`**: Gera um parecer técnico estruturado de triagem (relatório simulado/formatado) para apoio à tomada de decisão no RH.

---

## ⚡ Quickstart

```bash
# Analisa um repositório e salva o JSON localmente
npx mrcp-engine https://github.com/usuario/repositorio

# Auto-configura MCP no Claude Desktop, Cursor e Windsurf
npx mrcp-engine setup

```

---

## 📦 Instalação

### Via NPX (sem instalar)

```bash
npx mrcp-engine https://github.com/usuario/repositorio
```

Gera automaticamente um arquivo `mrcp-analysis.json` no diretório atual com a árvore estruturada completa.

Use `--no-save` para imprimir apenas no terminal sem salvar.

### Via NPM (instalação global)

```bash
npm install -g mrcp-engine
mrcp-engine https://github.com/usuario/repositorio

```

---

## 🤖 Integração com IAs (MCP)

O MRCP-Engine funciona como um servidor MCP (*Model Context Protocol*) — protocolo aberto para LLMs e IDEs consumirem ferramentas externas.

### Configuração Automática

```bash
npx mrcp-engine setup

```

Detecta automaticamente as IDEs instaladas (Claude Desktop, Cursor, Windsurf) e injeta a configuração.

### Configuração Manual

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "mrcp-engine": {
      "url": "https://mrcp-engine.vercel.app/api/mcp"
    }
  }
}

```

#### Cursor (Settings → MCP)

```json
{
  "mcpServers": {
    "mrcp-engine": {
      "url": "https://mrcp-engine.vercel.app/api/mcp"
    }
  }
}

```

#### Windsurf

```json
{
  "mcpServers": {
    "mrcp-engine": {
      "url": "https://mrcp-engine.vercel.app/api/mcp"
    }
  }
}

```

#### Via Processo Local (stdio)

Se a IDE não suportar endpoints HTTP remotos:

```json
{
  "mcpServers": {
    "mrcp-engine": {
      "command": "npx",
      "args": ["-y", "mrcp-engine"]
    }
  }
}

```

---

## 🌐 API REST & Serverless

Para agentes em nuvem (LangChain, LlamaIndex, Dify, GPTs Customizados):

| Endpoint | Método | Descrição |
| --- | --- | --- |
| `/api/analyze?repo=<url>` | `GET` | Retorna o grafo e AST estruturada do repositório |
| `/api/skills?repo=<url>` | `GET` | Retorna contratos de refatoração para hotspots |
| `/api/mcp` | `POST` | Endpoint central MCP (JSON-RPC 2.0) |
| `/api/mcp` | `GET` | Discovery — lista ferramentas e schemas disponíveis |

**Base URL:** `https://mrcp-engine.vercel.app`

### Exemplos de Chamada

```bash
# Analisar repositório
curl "https://mrcp-engine.vercel.app/api/analyze?repo=https://github.com/usuario/repo"

# Listar ferramentas MCP (JSON-RPC)
curl -X POST https://mrcp-engine.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

```

### ChatGPT Custom GPT

* **OpenAPI:** `https://mrcp-engine.vercel.app/openapi.json`
* **AI Plugin:** `https://mrcp-engine.vercel.app/.well-known/ai-plugin.json`

---

## 🎯 Skills de Arquitetura por Linguagem

O motor possui regras de arquitetura e qualidade de código especializadas para cada stack:

| Linguagem | Skill | Foco Principal |
| --- | --- | --- |
| TypeScript/JS | `Enterprise_TS_Modularization_Skill` | Modularização, tipagem estrita, isolamento de escopo |
| Python | `Karpathy_Python_Strict_Typing_Skill` | Type hints, dataclasses, PEP 484 |
| Rust | `Rust_Ownership_Safety_Skill` | Ownership, lifetimes, eliminação de unsafe |
| Go | `Go_Idiomatic_Concurrency_Skill` | Pacotes idiomáticos, goroutines, gerenciamento de contexto |
| Java | `Java_SOLID_Enterprise_Skill` | Princípios SOLID, Design Patterns, Records |
| C/C++ | `CPP_Memory_Safety_Audit_Skill` | RAII, smart pointers, const correctness |
| Ruby | `Ruby_Rails_Convention_Skill` | Service Objects, Concerns, CoC |
| PHP | `PHP_Modern_Architecture_Skill` | strict_types, injeção de dependência, DTOs |

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                       Clientes / IAs                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  CLI (npx)   │  MCP (stdio) │  MCP (HTTP)  │    REST API    │
├──────────────┴──────────────┴──────────────┴────────────────┤
│               [https://mrcp-engine.vercel.app](https://mrcp-engine.vercel.app)                │
├─────────────────────────────────────────────────────────────┤
│  [Core Engine]    → Tree-sitter AST | Metrics | Hotspots    │
│  [Web Scraper]    → Search | Smart Ranking | Clean Scraper  │
│  [Triage & HR]    → Resume Parser | Set Matching | Report   │
└─────────────────────────────────────────────────────────────┘

```

---

## 📄 Licença

MIT

```

```
