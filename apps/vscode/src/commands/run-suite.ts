import * as vscode from 'vscode';
import { analyzeWorkspaceLocally } from '../engine/local-analyzer';
import { MrcpSuiteResult } from '../engine/types';
import {
  MrcpHealthProvider,
  MrcpSecurityProvider,
  MrcpArchitectureProvider,
  MrcpQualityProvider,
  MrcpDocumentProvider
} from '../providers/tree-data-provider';
import { MrcpCodeLensProvider } from '../providers/codelens-provider';
import { MrcpDiagnosticsProvider } from '../providers/diagnostics-provider';
import { MrcpStatusBar } from '../providers/status-bar';
import { MrcpDashboardPanel } from '../webview/dashboard-panel';

export interface CommandContext {
  healthProvider: MrcpHealthProvider;
  securityProvider: MrcpSecurityProvider;
  architectureProvider: MrcpArchitectureProvider;
  qualityProvider: MrcpQualityProvider;
  documentProvider: MrcpDocumentProvider;
  codeLensProvider: MrcpCodeLensProvider;
  diagnosticsProvider: MrcpDiagnosticsProvider;
  statusBar: MrcpStatusBar;
  extensionUri: vscode.Uri;
  getLastResult: () => MrcpSuiteResult | undefined;
  setLastResult: (result: MrcpSuiteResult) => void;
}

export async function runFullSuiteCommand(ctx: CommandContext): Promise<MrcpSuiteResult | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Nenhum workspace ou pasta aberta no VS Code.');
    return undefined;
  }

  const rootPath = folders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('mrcp');
  const maxFiles = config.get<number>('maxFiles', 2000);

  ctx.statusBar.setAnalyzing('Escaneando...');

  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'MRCP Engine: Executando Diagnóstico do Workspace',
      cancellable: false
    },
    async (progress) => {
      try {
        let lastPct = 0;
        const result = await analyzeWorkspaceLocally(rootPath, maxFiles, (pct, msg) => {
          const increment = Math.max(0, pct - lastPct);
          lastPct = pct;
          progress.report({ increment, message: msg });
        });

        // Store result
        ctx.setLastResult(result);

        // Update all providers
        ctx.healthProvider.update(result);
        ctx.securityProvider.update(result);
        ctx.architectureProvider.update(result);
        ctx.qualityProvider.update(result);
        ctx.documentProvider.update(result);
        ctx.codeLensProvider.update(result);
        ctx.diagnosticsProvider.update(result);
        ctx.statusBar.update(result);

        if (MrcpDashboardPanel.currentPanel) {
          MrcpDashboardPanel.currentPanel.update(result);
        }

        const msg = `✅ MRCP: Diagnóstico concluído! Saúde: ${result.summary.healthScore}/100 (Nota ${result.summary.letterGrade}) | Economia de Tokens: ~${result.summary.tokenSavingsPercent}%`;
        vscode.window.showInformationMessage(msg, 'Abrir Cockpit', 'Copiar Contexto IA').then((action) => {
          if (action === 'Abrir Cockpit') {
            vscode.commands.executeCommand('mrcp.openDashboard');
          } else if (action === 'Copiar Contexto IA') {
            vscode.commands.executeCommand('mrcp.copyAiContext');
          }
        });

        return result;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro durante análise MRCP: ${err.message}`);
        ctx.statusBar.dispose();
        return undefined;
      }
    }
  );
}
