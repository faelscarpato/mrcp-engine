import * as vscode from "vscode";
import * as path from "path";
import { MrcpSuiteResult } from "../engine/types";

export class MrcpCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  private currentResult?: MrcpSuiteResult;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  update(result: MrcpSuiteResult): void {
    this.currentResult = result;
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration("mrcp");
    if (!config.get<boolean>("enableCodeLens", true)) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
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
