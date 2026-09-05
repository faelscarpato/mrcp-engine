import * as vscode from "vscode";
import { MrcpSuiteResult } from "./engine/types";
import {
  MrcpQuickActionsProvider,
  MrcpHealthProvider,
  MrcpSecurityProvider,
  MrcpArchitectureProvider,
  MrcpQualityProvider,
  MrcpDocumentProvider,
} from "./providers/tree-data-provider";
import { MrcpCodeLensProvider } from "./providers/codelens-provider";
import { MrcpDiagnosticsProvider } from "./providers/diagnostics-provider";
import { MrcpStatusBar } from "./providers/status-bar";
import { MrcpDashboardPanel } from "./webview/dashboard-panel";
import { runFullSuiteCommand, CommandContext } from "./commands/run-suite";
import {
  copyAiContextCommand,
  copyFileContextCommand,
} from "./commands/copy-context";
import { exportReportCommand } from "./commands/export-report";

let lastSuiteResult: MrcpSuiteResult | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("[MRCP-Engine] Extensão ativada com sucesso!");

  // 1. Initialize Providers
  const quickActionsProvider = new MrcpQuickActionsProvider();
  const healthProvider = new MrcpHealthProvider();
  const securityProvider = new MrcpSecurityProvider();
  const architectureProvider = new MrcpArchitectureProvider();
  const qualityProvider = new MrcpQualityProvider();
  const documentProvider = new MrcpDocumentProvider();

  const codeLensProvider = new MrcpCodeLensProvider();
  const diagnosticsProvider = new MrcpDiagnosticsProvider();
  const statusBar = new MrcpStatusBar();

  // 2. Register Tree Views
  vscode.window.registerTreeDataProvider(
    "mrcp.views.quickActions",
    quickActionsProvider,
  );
  vscode.window.registerTreeDataProvider("mrcp.views.health", healthProvider);
  vscode.window.registerTreeDataProvider(
    "mrcp.views.security",
    securityProvider,
  );
  vscode.window.registerTreeDataProvider(
    "mrcp.views.architecture",
    architectureProvider,
  );
  vscode.window.registerTreeDataProvider("mrcp.views.quality", qualityProvider);
  vscode.window.registerTreeDataProvider(
    "mrcp.views.documents",
    documentProvider,
  );

  // 3. Register CodeLens
  const supportedLanguages = [
    "typescript",
    "javascript",
    "typescriptreact",
    "javascriptreact",
    "python",
    "go",
    "rust",
    "java",
    "c",
    "cpp",
    "php",
    "ruby",
    "csharp",
  ];
  for (const lang of supportedLanguages) {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: lang, scheme: "file" },
        codeLensProvider,
      ),
    );
  }

  // 4. Command Context Pack
  const cmdContext: CommandContext = {
    healthProvider,
    securityProvider,
    architectureProvider,
    qualityProvider,
    documentProvider,
    codeLensProvider,
    diagnosticsProvider,
    statusBar,
    extensionUri: context.extensionUri,
    getLastResult: () => lastSuiteResult,
    setLastResult: (res: MrcpSuiteResult) => {
      lastSuiteResult = res;
    },
  };

  // 5. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("mrcp.runFullSuite", () =>
      runFullSuiteCommand(cmdContext),
    ),

    vscode.commands.registerCommand("mrcp.openDashboard", () => {
      MrcpDashboardPanel.createOrShow(context.extensionUri, lastSuiteResult);
    }),

    vscode.commands.registerCommand("mrcp.copyAiContext", () =>
      copyAiContextCommand(cmdContext),
    ),

    vscode.commands.registerCommand("mrcp.copyFileContext", () =>
      copyFileContextCommand(cmdContext),
    ),

    vscode.commands.registerCommand("mrcp.auditSecurity", async () => {
      if (!lastSuiteResult) {
        await runFullSuiteCommand(cmdContext);
      }
      vscode.commands.executeCommand("mrcp.views.security.focus");
    }),

    vscode.commands.registerCommand("mrcp.detectDeadCode", async () => {
      if (!lastSuiteResult) {
        await runFullSuiteCommand(cmdContext);
      }
      vscode.commands.executeCommand("mrcp.views.quality.focus");
    }),

    vscode.commands.registerCommand("mrcp.validateEnv", async () => {
      if (!lastSuiteResult) {
        await runFullSuiteCommand(cmdContext);
      }
      vscode.commands.executeCommand("mrcp.views.security.focus");
    }),

    vscode.commands.registerCommand("mrcp.exportReport", () =>
      exportReportCommand(cmdContext),
    ),

    vscode.commands.registerCommand("mrcp.refresh", () =>
      runFullSuiteCommand(cmdContext),
    ),

    vscode.commands.registerCommand(
      "mrcp.openFileAtLocation",
      async (filePath: string, line: number) => {
        try {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(filePath),
          );
          const editor = await vscode.window.showTextDocument(doc, {
            preview: true,
          });
          const targetLine = Math.max(0, (line || 1) - 1);
          const position = new vscode.Position(targetLine, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter,
          );
        } catch (err: any) {
          vscode.window.showErrorMessage(
            `Não foi possível abrir o arquivo: ${filePath}`,
          );
        }
      },
    ),
  );

  // 6. Watchers / Auto-Analyze on save (if configured)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const config = vscode.workspace.getConfiguration("mrcp");
      if (config.get<boolean>("autoAnalyzeOnSave", false)) {
        if (supportedLanguages.includes(doc.languageId)) {
          runFullSuiteCommand(cmdContext);
        }
      }
    }),
  );

  // 7. Cleanup subscriptions
  context.subscriptions.push(statusBar);
  context.subscriptions.push({ dispose: () => diagnosticsProvider.dispose() });

  // Optional: Trigger initial background scan on startup if workspace is open
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    // Light initial delay to allow VS Code to settle
    setTimeout(() => {
      runFullSuiteCommand(cmdContext);
    }, 1500);
  }
}

export function deactivate() {
  if (MrcpDashboardPanel.currentPanel) {
    MrcpDashboardPanel.currentPanel.dispose();
  }
}
