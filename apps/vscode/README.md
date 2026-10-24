# 🧩 MRCP Engine — Extensão para VS Code, Cursor & Windsurf v2.7.6

> **Deterministic AI Context & Code Health Cockpit**  
> Redução de até 95% no consumo de tokens para LLMs, auditoria de segurança estática, índice de manutenibilidade e visualização de grafos AST diretamente no seu editor de código com suporte completo a **40 linguagens nativas via Tree-sitter WebAssembly**: TypeScript, JavaScript, Python, Go, Rust, Java, C/C++, PHP, Ruby, C#, Swift, Kotlin, ActionScript, AppleScript, AutoHotkey, AutoIt, Bicep, Jenkins Pipeline, CFML, Verse, Q/KDB+, Modelica, InterSystems ObjectScript, Natural, Pascal, OpenSCAD, Pawn, Salesforce Apex, SAS, Siemens SCL, Structured Text, MQL5, RPGLE, PineScript, JCL, PowerQuery, DAX, T-SQL, VBA, VHDL e Web3 (Vyper & Move).

---

## ✨ Identidade Visual & Ícones Oficiais

A extensão conta com identidade visual dedicada e segregada por contexto de uso:

- **🖼️ Marketplace & Gerenciador de Extensões (`mrcp-icon.png`):** Ícone em alta resolução (PNG) exibido na vitrine do Visual Studio Marketplace e no painel de download/gerenciamento de extensões do VS Code e Cursor.
- **⚡ Barra Lateral Fixa (`mrcp-icon.svg`):** Ícone vetorial SVG otimizado exibido na **Activity Bar** lateral esquerda, garantindo nitidez e perfeita integração aos temas Claro, Escuro e High Contrast.

---

## ✨ Funcionalidades Principais

### 1. ⚡ Painel Lateral (Activity Bar — "MRCP Engine")

Um ícone dedicado na barra lateral contendo 6 visualizações integradas:

- **⚡ Ações Rápidas:** Execução da suíte completa com 1 clique, cópia de contexto para IA, auditoria de segurança, detecção de código morto e geração de relatório Markdown.
- **📊 Saúde & Métricas:** Nota de Manutenibilidade (Grade A/B/C/D/F), Health Score (0-100), Módulos Gigantes (_God Modules_) e Complexidade Ciclomática Média.
- **🛡️ Segurança & Segredos:** Listagem de chaves de API expostas, senhas hardcoded e variáveis `process.env` ausentes no `.env` (clicar no item abre o arquivo diretamente na linha afetada).
- **🏗️ Arquitetura & Dependências:** Detecção de ciclos de dependência e mapeamento de rotas REST/RPC.
- **🧪 Gaps de Testes & Código Morto:** Funções públicas com complexidade relevante sem cobertura de testes e exports zumbis.
- **📄 Inteligência Documental (DQI):** Contagem e avaliação de documentos não-código (PDF, DOCX, CSV, XLSX, MD) com _Document Quality Index_.

---

### 2. 📊 MRCP Cockpit Interativo (Webview Dashboard)

Uma aba visual moderna, totalmente integrada ao tema claro/escuro do seu editor:

- **Cards de KPIs em Tempo Real:** Nota de saúde, taxa de economia de tokens, falhas de segurança e total de símbolos.
- **Visualizador de Grafo AST:** Renderização do grafo arquitetural do projeto.
- **Tabelas Filtráveis:** Inspeção detalhada de rotas de API, segurança, arquivos críticos (_Hotspots_) e documentos.
- **Botões de Ação Imediata:** Exportação de contexto para IA e geração de relatórios `.md`.

---

### 3. 🔍 Superpoderes no Editor (CodeLens & Diagnostics)

- **CodeLens Dinâmico:** Exibe métricas de complexidade ciclomática (`⚡ MRCP: Complexidade 3 (Baixa 🟢)`) e atalhos rápidos (`📋 Copiar para IA`) sobre funções, classes e métodos em todas as 40 linguagens suportadas no workspace.
- **Painel de Problemas ("Problems"):** Publica alertas de segurança e variáveis de ambiente ausentes no painel nativo do VS Code com realce no código.
- **Status Bar Item:** Mostra o score consolidado no rodapé do editor (`$(shield) MRCP: A (94/100)`).

---

### 4. 🤖 Empacotador de Contexto IA (Economia de 95% em Tokens)

Elimina o desperdício de contexto enviando para o ChatGPT, Claude, Cursor ou Copilot apenas as assinaturas determinísticas, contratos tipados e diretrizes operacionais do projeto.

---

## ⌨️ Comandos Disponíveis (`Ctrl+Shift+P` / `Cmd+Shift+P`)

| Comando                                                  | Descrição                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `MRCP: Executar Diagnóstico Completo (Full Suite)`       | Executa todas as ferramentas de análise no workspace atual |
| `MRCP: Abrir Cockpit Interativo & Grafo AST`             | Abre o dashboard visual com gráficos e tabelas             |
| `MRCP: Copiar Contexto Otimizado para IA`                | Gera e copia o pacote determinístico (95% menos tokens)    |
| `MRCP: Copiar Assinatura / Contexto do Arquivo Ativo`    | Copia apenas a assinatura e contexto do arquivo atual      |
| `MRCP: Auditar Segurança e Segredos (.env)`              | Foca na árvore de segurança e chaves de ambiente           |
| `MRCP: Detectar Código Morto & Exports Não Utilizados`   | Localiza e exibe exports zumbis                            |
| `MRCP: Exportar Relatório Diagnóstico Consolidado (.md)` | Cria e abre o arquivo `MRCP_DIAGNOSTIC_REPORT.md`          |
| `MRCP: Atualizar Análise`                                | Reexecuta a varredura e atualiza o estado                  |

---

## ⚙️ Configurações da Extensão

Você pode configurar a extensão em **Settings** (`Ctrl+,`):

```json
{
  "mrcp.autoAnalyzeOnSave": false, // Executa análise incremental leve ao salvar arquivos
  "mrcp.enableCodeLens": true, // Exibe métricas de complexidade acima de funções
  "mrcp.enableNativeDiagnostics": true, // Publica falhas no painel de Problemas
  "mrcp.maxFiles": 2000 // Limite máximo de arquivos escaneados
}
```

---

## 📦 Como Compilar e Empacotar (`.vsix`)

Para gerar o pacote instalável da extensão:

```bash
# 1. Instalar dependências e compilar
pnpm --filter mrcp-vscode compile

# 2. Gerar o arquivo .vsix (utilizando vsce)
cd apps/vscode
npm run package
# Gera: mrcp-vscode-2.7.6.vsix
```

Para instalar o arquivo `.vsix` gerado no VS Code ou Cursor:

```bash
code --install-extension mrcp-vscode-2.7.6.vsix
# ou no Cursor:
cursor --install-extension mrcp-vscode-2.7.6.vsix
```

---

## 📄 Licença

MIT © MRCP Engine Team
