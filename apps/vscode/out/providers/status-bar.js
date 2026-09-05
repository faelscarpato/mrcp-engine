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
exports.MrcpStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class MrcpStatusBar {
  statusBarItem;
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "mrcp.openDashboard";
    this.statusBarItem.text = "$(shield) MRCP: Pronto";
    this.statusBarItem.tooltip = "Clique para abrir o MRCP Cockpit";
    this.statusBarItem.show();
  }
  setAnalyzing(statusText = "Analisando...") {
    this.statusBarItem.text = `$(sync~spin) MRCP: ${statusText}`;
    this.statusBarItem.tooltip = "MRCP-Engine está escaneando o workspace...";
  }
  update(result) {
    const { summary } = result;
    const grade = summary.letterGrade;
    const score = summary.healthScore;
    this.statusBarItem.text = `$(shield) MRCP: ${grade} (${score}/100)`;
    this.statusBarItem.tooltip = `MRCP Saúde: ${score}/100 (Nota ${grade})\nEconomia de Tokens: ~${summary.tokenSavingsPercent}%\nVulnerabilidades: ${summary.securityIssuesCount}\nClique para abrir o Dashboard`;
  }
  dispose() {
    this.statusBarItem.dispose();
  }
}
exports.MrcpStatusBar = MrcpStatusBar;
//# sourceMappingURL=status-bar.js.map
