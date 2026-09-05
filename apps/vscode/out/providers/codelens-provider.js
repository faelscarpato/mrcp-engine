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
exports.MrcpCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
class MrcpCodeLensProvider {
  _onDidChangeCodeLenses = new vscode.EventEmitter();
  onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  currentResult;
  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }
  update(result) {
    this.currentResult = result;
    this._onDidChangeCodeLenses.fire();
  }
  provideCodeLenses(document, token) {
    const config = vscode.workspace.getConfiguration("mrcp");
    if (!config.get("enableCodeLens", true)) {
      return [];
    }
    const codeLenses = [];
    const text = document.getText();
    const lines = text.split("\n");
    // Quick regex for functions & classes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fnMatch =
        line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/) ||
        line.match(
          /(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
        ) ||
        line.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (
        fnMatch &&
        fnMatch[1] &&
        !["if", "for", "while", "switch"].includes(fnMatch[1])
      ) {
        const symName = fnMatch[1];
        const range = new vscode.Range(i, 0, i, line.length);
        // Approximate complexity
        const complexityTokens = line.match(
          /\b(if|for|while|case|catch)\b|\?|&&|\|\|/g,
        );
        const comp = (complexityTokens?.length || 0) + 1;
        const compLabel =
          comp > 10 ? "Alta 🔴" : comp > 5 ? "Média 🟡" : "Baixa 🟢";
        // 1. Complexity lens
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `⚡ MRCP: Complexidade ${comp} (${compLabel})`,
            command: "mrcp.openDashboard",
            tooltip: `Complexidade ciclomática estimada: ${comp}`,
          }),
        );
        // 2. AI Copy Signature lens
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `📋 Copiar para IA`,
            command: "mrcp.copyFileContext",
            tooltip: `Copia a assinatura e contexto deste arquivo para prompt de IA`,
          }),
        );
      }
    }
    return codeLenses;
  }
}
exports.MrcpCodeLensProvider = MrcpCodeLensProvider;
//# sourceMappingURL=codelens-provider.js.map
