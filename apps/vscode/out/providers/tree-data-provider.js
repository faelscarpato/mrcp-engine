"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MrcpDocumentProvider =
  exports.MrcpQualityProvider =
  exports.MrcpArchitectureProvider =
  exports.MrcpSecurityProvider =
  exports.MrcpHealthProvider =
  exports.MrcpQuickActionsProvider =
  exports.MrcpTreeItem =
    void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class MrcpTreeItem extends vscode.TreeItem {
  label;
  collapsibleState;
  itemData;
  constructor(label, collapsibleState, itemData) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.itemData = itemData;
    if (itemData?.description) this.description = itemData.description;
    if (itemData?.tooltip) this.tooltip = itemData.tooltip;
    if (itemData?.contextValue) this.contextValue = itemData.contextValue;
    if (itemData?.iconName) {
      this.iconPath = new vscode.ThemeIcon(itemData.iconName);
    }
    if (itemData?.commandId) {
      this.command = {
        command: itemData.commandId,
        title: itemData.commandTitle || label || "",
        arguments: itemData.commandArgs,
      };
    } else if (itemData?.filePath) {
      this.command = {
        command: "mrcp.openFileAtLocation",
        title: "Abrir Arquivo",
        arguments: [itemData.filePath, itemData.line || 1],
      };
    }
  }
}
exports.MrcpTreeItem = MrcpTreeItem;
class MrcpQuickActionsProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    return [
      new MrcpTreeItem(
        "⚡ Executar Diagnóstico Completo (Full Suite)",
        vscode.TreeItemCollapsibleState.None,
        {
          commandId: "mrcp.runFullSuite",
          iconName: "play-circle",
          tooltip:
            "Executa todas as ferramentas de diagnóstico AST, segurança, código morto e métricas.",
        },
      ),
      new MrcpTreeItem(
        "📋 Copiar Contexto AI (Tokens 95% Menores)",
        vscode.TreeItemCollapsibleState.None,
        {
          commandId: "mrcp.copyAiContext",
          iconName: "copy",
          tooltip:
            "Gera pacote determinístico de assinaturas para colar no ChatGPT, Claude ou Cursor.",
        },
      ),
      new MrcpTreeItem(
        "📊 Abrir MRCP Cockpit Interativo",
        vscode.TreeItemCollapsibleState.None,
        {
          commandId: "mrcp.openDashboard",
          iconName: "dashboard",
          tooltip:
            "Visualiza gráficos, métricas e grafo de nós do repositório.",
        },
      ),
      new MrcpTreeItem(
        "🛡️ Auditar Segurança & Segredos (.env)",
        vscode.TreeItemCollapsibleState.None,
        {
          commandId: "mrcp.auditSecurity",
          iconName: "shield",
          tooltip: "Verifica chaves expostas e variáveis ausentes no .env.",
        },
      ),
      new MrcpTreeItem(
        "🧹 Detectar Código Morto & Exports Zumbis",
        vscode.TreeItemCollapsibleState.None,
        {
          commandId: "mrcp.detectDeadCode",
          iconName: "trash",
          tooltip: "Localiza exports nunca referenciados no projeto.",
        },
      ),
      new MrcpTreeItem(
        "📄 Gerar Relatório Executivo (.md)",
        vscode.TreeItemCollapsibleState.None,
        {
          commandId: "mrcp.exportReport",
          iconName: "markdown",
          tooltip: "Salva relatório técnico completo em markdown no workspace.",
        },
      ),
    ];
  }
}
exports.MrcpQuickActionsProvider = MrcpQuickActionsProvider;
class MrcpHealthProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  currentResult;
  update(result) {
    this.currentResult = result;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    if (!this.currentResult) {
      return [
        new MrcpTreeItem(
          "Nenhuma análise executada ainda. Clique em Executar Diagnóstico.",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "info" },
        ),
      ];
    }
    const { summary } = this.currentResult;
    const gradeIcon =
      summary.letterGrade === "A"
        ? "pass-filled"
        : summary.letterGrade === "B"
          ? "check"
          : summary.letterGrade === "C"
            ? "warning"
            : "error";
    return [
      new MrcpTreeItem(
        `Nota Geral: ${summary.letterGrade} (${summary.healthScore}/100)`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: gradeIcon,
          description: "Score consolidado de saúde",
        },
      ),
      new MrcpTreeItem(
        `Índice de Manutenibilidade: ${summary.maintainabilityIndex}/100`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: "pulse",
          description:
            summary.maintainabilityIndex > 75 ? "Excelente" : "Requer Atenção",
        },
      ),
      new MrcpTreeItem(
        `Economia de Tokens LLM: ~${summary.tokenSavingsPercent}%`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: "zap",
          description: `${summary.estimatedTokensWithMrcp} vs ${summary.estimatedTokensWithoutMrcp} tokens`,
        },
      ),
      new MrcpTreeItem(
        `Arquivos Analisados: ${summary.totalFiles}`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: "files",
          description: `${summary.totalLinesOfCode} linhas de código`,
        },
      ),
      new MrcpTreeItem(
        `Símbolos Extraídos: ${summary.totalSymbols}`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: "symbol-method",
        },
      ),
      new MrcpTreeItem(
        `Complexidade Ciclomática Média: ${summary.avgComplexity}`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: "circuit-board",
        },
      ),
      new MrcpTreeItem(
        `Módulos Gigantes (God Modules): ${summary.godModulesCount}`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: summary.godModulesCount === 0 ? "check" : "alert",
          description:
            summary.godModulesCount > 0
              ? ">400 linhas ou complexidade >35"
              : "Nenhum",
        },
      ),
    ];
  }
}
exports.MrcpHealthProvider = MrcpHealthProvider;
class MrcpSecurityProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  currentResult;
  update(result) {
    this.currentResult = result;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    if (!this.currentResult) {
      return [
        new MrcpTreeItem(
          "Execute a análise para auditar segurança.",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "info" },
        ),
      ];
    }
    const items = [];
    // Security Findings
    if (
      this.currentResult.securityIssues.length === 0 &&
      this.currentResult.envIssues.length === 0
    ) {
      items.push(
        new MrcpTreeItem(
          "✅ Nenhuma vulnerabilidade ou segredo exposto!",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "shield" },
        ),
      );
      return items;
    }
    for (const sec of this.currentResult.securityIssues) {
      const fullPath = path.join(this.currentResult.workspaceRoot, sec.file);
      items.push(
        new MrcpTreeItem(
          `${sec.rule}: ${sec.message}`,
          vscode.TreeItemCollapsibleState.None,
          {
            iconName:
              sec.severity === "critical" || sec.severity === "high"
                ? "error"
                : "warning",
            description: `${sec.file}:${sec.line}`,
            filePath: fullPath,
            line: sec.line,
            tooltip: `${sec.message}\nClique para ir até a linha.`,
          },
        ),
      );
    }
    for (const env of this.currentResult.envIssues) {
      const fullPath = path.join(this.currentResult.workspaceRoot, env.file);
      items.push(
        new MrcpTreeItem(
          `Env Ausente: process.env.${env.variableName}`,
          vscode.TreeItemCollapsibleState.None,
          {
            iconName: "key",
            description: `Não encontrada no .env (${env.file}:${env.line})`,
            filePath: fullPath,
            line: env.line,
            tooltip: `A variável ${env.variableName} é usada no código mas não está declarada no .env`,
          },
        ),
      );
    }
    return items;
  }
}
exports.MrcpSecurityProvider = MrcpSecurityProvider;
class MrcpArchitectureProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  currentResult;
  update(result) {
    this.currentResult = result;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    if (!this.currentResult) {
      return [
        new MrcpTreeItem(
          "Execute a análise para visualizar arquitetura.",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "info" },
        ),
      ];
    }
    const items = [];
    if (this.currentResult.dependencyCycles.length === 0) {
      items.push(
        new MrcpTreeItem(
          "✅ Zero ciclos de dependência detectados!",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "check" },
        ),
      );
    } else {
      for (const cycle of this.currentResult.dependencyCycles) {
        items.push(
          new MrcpTreeItem(
            `Ciclo de Dependência (${cycle.length} arquivos)`,
            vscode.TreeItemCollapsibleState.None,
            {
              iconName: "warning",
              description: cycle.files.map((f) => path.basename(f)).join(" ➔ "),
              tooltip: cycle.files.join(" ➔ "),
            },
          ),
        );
      }
    }
    if (this.currentResult.apiRoutes.length > 0) {
      items.push(
        new MrcpTreeItem(
          `🌐 Rotas de API Detectadas (${this.currentResult.apiRoutes.length})`,
          vscode.TreeItemCollapsibleState.None,
          {
            iconName: "globe",
            description: "Endpoints REST / RPC",
          },
        ),
      );
    }
    return items;
  }
}
exports.MrcpArchitectureProvider = MrcpArchitectureProvider;
class MrcpQualityProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  currentResult;
  update(result) {
    this.currentResult = result;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    if (!this.currentResult) {
      return [
        new MrcpTreeItem(
          "Execute a análise para checar qualidade.",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "info" },
        ),
      ];
    }
    const items = [];
    // Dead Code
    for (const dead of this.currentResult.deadCodeItems.slice(0, 15)) {
      const fullPath = path.join(this.currentResult.workspaceRoot, dead.file);
      items.push(
        new MrcpTreeItem(
          `Código Morto: ${dead.symbolName} (${dead.kind})`,
          vscode.TreeItemCollapsibleState.None,
          {
            iconName: "trash",
            description: `${dead.file}:${dead.line}`,
            filePath: fullPath,
            line: dead.line,
            tooltip: `O símbolo "${dead.symbolName}" está exportado mas nunca é importado.`,
          },
        ),
      );
    }
    // Test Gaps
    for (const gap of this.currentResult.testGaps.slice(0, 15)) {
      const fullPath = path.join(this.currentResult.workspaceRoot, gap.file);
      items.push(
        new MrcpTreeItem(
          `Gap de Teste: ${gap.functionName}()`,
          vscode.TreeItemCollapsibleState.None,
          {
            iconName: "beaker",
            description: `${gap.file}:${gap.line}`,
            filePath: fullPath,
            line: gap.line,
            tooltip: `A função "${gap.functionName}" possui complexidade relevante e não tem arquivo de teste correspondente.`,
          },
        ),
      );
    }
    if (items.length === 0) {
      items.push(
        new MrcpTreeItem(
          "✅ Zero gaps críticos ou código morto detectado!",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "check" },
        ),
      );
    }
    return items;
  }
}
exports.MrcpQualityProvider = MrcpQualityProvider;
class MrcpDocumentProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  currentResult;
  update(result) {
    this.currentResult = result;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (element) return [];
    if (!this.currentResult) {
      return [
        new MrcpTreeItem(
          "Execute a análise para visualizar documentos.",
          vscode.TreeItemCollapsibleState.None,
          { iconName: "info" },
        ),
      ];
    }
    const items = [];
    items.push(
      new MrcpTreeItem(
        `DQI (Document Quality Index): ${this.currentResult.summary.documentQualityScore}/100`,
        vscode.TreeItemCollapsibleState.None,
        {
          iconName: "book",
          description: `${this.currentResult.documents.length} documentos indexados`,
        },
      ),
    );
    for (const doc of this.currentResult.documents.slice(0, 20)) {
      const fullPath = path.join(this.currentResult.workspaceRoot, doc.file);
      items.push(
        new MrcpTreeItem(
          `${doc.file} [${doc.format}]`,
          vscode.TreeItemCollapsibleState.None,
          {
            iconName: "file-text",
            description: `${doc.wordCount} palavras • DQI: ${doc.qualityScore}`,
            filePath: fullPath,
            line: 1,
          },
        ),
      );
    }
    return items;
  }
}
exports.MrcpDocumentProvider = MrcpDocumentProvider;
//# sourceMappingURL=tree-data-provider.js.map
