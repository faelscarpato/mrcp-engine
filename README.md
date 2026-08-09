# 🧠 MRCP-Engine

**Machine-Readable Context Protocol Engine**

Motor de inteligência estrutural que transforma repositórios de código em grafos AST otimizados para consumo por IAs. Elimina o "AI Tax" — o desperdício de tokens quando LLMs lêem código bruto.

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

O MRCP-Engine funciona como servidor MCP — protocolo aberto para IAs consumirem ferramentas externas.

### Configuração Automática
```bash
npx mrcp-engine setup
```
Detecta automaticamente IDEs instaladas (Claude Desktop, Cursor, Windsurf) e configura o MCP.

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
Se a IDE não suportar URLs MCP remotas, use o modo local:
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

### Uso na Conversa com a IA
Após configurar, basta dizer no chat:
> *"Use o mrcp-engine para analisar a arquitetura do repositório https://github.com/..."*

A IA chamará automaticamente as ferramentas do MRCP-Engine.

---

## 🌐 API REST (Serverless)

Para agentes em nuvem (LangChain, LlamaIndex, Dify, GPTs Customizados):

| Endpoint | Descrição |
|---|---|
| `GET /api/analyze?repo=<url>` | Retorna a AST estruturada do repositório |
| `GET /api/skills?repo=<url>` | Retorna contratos de skills para hotspots |
| `POST /api/mcp` | Endpoint MCP (JSON-RPC 2.0) |
| `GET /api/mcp` | Discovery — lista ferramentas disponíveis |

**Base URL:** `https://mrcp-engine.vercel.app`

### Exemplos
```bash
# Analisar repositório
curl "https://mrcp-engine.vercel.app/api/analyze?repo=https://github.com/usuario/repo"

# Obter skills de hotspots
curl "https://mrcp-engine.vercel.app/api/skills?repo=https://github.com/usuario/repo"

# Listar ferramentas MCP
curl -X POST https://mrcp-engine.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### ChatGPT Custom GPT
Use os manifestos já disponíveis:
- **OpenAPI:** `https://mrcp-engine.vercel.app/openapi.json`
- **AI Plugin:** `https://mrcp-engine.vercel.app/.well-known/ai-plugin.json`

---

## 🎯 Skills por Linguagem

O MRCP-Engine possui skills especializadas para cada linguagem, com diretivas e thresholds específicos:

| Linguagem | Skill | Foco |
|---|---|---|
| TypeScript/JS | `Enterprise_TS_Modularization_Skill` | Modularização, tipagem estrita, barrel exports |
| Python | `Karpathy_Python_Strict_Typing_Skill` | Type hints, dataclasses, PEP 484 |
| Rust | `Rust_Ownership_Safety_Skill` | Ownership, lifetimes, eliminação de unsafe |
| Go | `Go_Idiomatic_Concurrency_Skill` | Pacotes idiomáticos, goroutines, context |
| Java | `Java_SOLID_Enterprise_Skill` | SOLID, Design Patterns, Records |
| C/C++ | `CPP_Memory_Safety_Audit_Skill` | RAII, smart pointers, const correctness |
| Ruby | `Ruby_Rails_Convention_Skill` | Service Objects, Concerns, CoC |
| PHP | `PHP_Modern_Architecture_Skill` | strict_types, DI, DTOs tipados |

Cada skill classifica módulos em 3 níveis: **STABLE**, **WARNING**, **CRITICAL_GOD_MODULE** — com diretivas acionáveis para refatoração.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────┐
│                  Usuário / IA                    │
├──────────┬──────────┬──────────┬────────────────┤
│  CLI     │  MCP     │  MCP     │  REST API      │
│  (npx)   │  (stdio) │  (HTTP)  │  (curl/fetch)  │
├──────────┴──────────┴──────────┴────────────────┤
│         https://mrcp-engine.vercel.app           │
├─────────────────────────────────────────────────┤
│  Pipeline: GitHub API → Tree-Sitter AST →       │
│  Graph Builder → Metrics → Skill Injector       │
└─────────────────────────────────────────────────┘
```

- **CLI** → Cliente HTTP puro, faz fetch para a API e salva JSON local
- **MCP stdio** → Bridge local para IDEs que requerem processo
- **MCP HTTP** → Endpoint JSON-RPC 2.0 stateless na Vercel
- **REST API** → Endpoints GET diretos para integração de backend

---

## 📄 Licença

MIT
