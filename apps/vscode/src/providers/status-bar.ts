import * as vscode from 'vscode';
import { MrcpSuiteResult } from '../engine/types';

export class MrcpStatusBar {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'mrcp.openDashboard';
    this.statusBarItem.text = '$(shield) MRCP: Pronto';
    this.statusBarItem.tooltip = 'Clique para abrir o MRCP Cockpit';
    this.statusBarItem.show();
  }

  setAnalyzing(statusText = 'Analisando...'): void {
    this.statusBarItem.text = `$(sync~spin) MRCP: ${statusText}`;
    this.statusBarItem.tooltip = 'MRCP-Engine está escaneando o workspace...';
  }

  update(result: MrcpSuiteResult): void {
    const { summary } = result;
    const grade = summary.letterGrade;
    const score = summary.healthScore;

    this.statusBarItem.text = `$(shield) MRCP: ${grade} (${score}/100)`;
    this.statusBarItem.tooltip = `MRCP Saúde: ${score}/100 (Nota ${grade})\nEconomia de Tokens: ~${summary.tokenSavingsPercent}%\nVulnerabilidades: ${summary.securityIssuesCount}\nClique para abrir o Dashboard`;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
