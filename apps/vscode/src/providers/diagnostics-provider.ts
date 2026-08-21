import * as vscode from 'vscode';
import * as path from 'path';
import { MrcpSuiteResult } from '../engine/types';

export class MrcpDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('mrcp');
  }

  update(result: MrcpSuiteResult): void {
    const config = vscode.workspace.getConfiguration('mrcp');
    if (!config.get<boolean>('enableNativeDiagnostics', true)) {
      this.diagnosticCollection.clear();
      return;
    }

    this.diagnosticCollection.clear();
    const map = new Map<string, vscode.Diagnostic[]>();

    // 1. Security issues
    for (const sec of result.securityIssues) {
      const fullPath = path.join(result.workspaceRoot, sec.file);
      const uri = vscode.Uri.file(fullPath);
      const line = Math.max(0, sec.line - 1);
      const range = new vscode.Range(line, 0, line, 120);

      const severity = (sec.severity === 'critical' || sec.severity === 'high')
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

      const diagnostic = new vscode.Diagnostic(
        range,
        `[MRCP Security] ${sec.rule}: ${sec.message}`,
        severity
      );
      diagnostic.source = 'MRCP-Engine';
      diagnostic.code = sec.rule;

      const list = map.get(uri.fsPath) || [];
      list.push(diagnostic);
      map.set(uri.fsPath, list);
    }

    // 2. Env missing issues
    for (const env of result.envIssues) {
      const fullPath = path.join(result.workspaceRoot, env.file);
      const uri = vscode.Uri.file(fullPath);
      const line = Math.max(0, env.line - 1);
      const range = new vscode.Range(line, 0, line, 120);

      const diagnostic = new vscode.Diagnostic(
        range,
        `[MRCP Env] Variável process.env.${env.variableName} não está declarada no .env ou .env.example.`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'MRCP-Engine';
      diagnostic.code = 'MISSING_ENV_VAR';

      const list = map.get(uri.fsPath) || [];
      list.push(diagnostic);
      map.set(uri.fsPath, list);
    }

    // Apply to collection
    for (const [filePath, diagnostics] of map.entries()) {
      this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    }
  }

  clear(): void {
    this.diagnosticCollection.clear();
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
