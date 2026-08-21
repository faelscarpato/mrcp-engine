"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const tree_data_provider_1 = require("./providers/tree-data-provider");
const codelens_provider_1 = require("./providers/codelens-provider");
const diagnostics_provider_1 = require("./providers/diagnostics-provider");
const status_bar_1 = require("./providers/status-bar");
const dashboard_panel_1 = require("./webview/dashboard-panel");
const run_suite_1 = require("./commands/run-suite");
const copy_context_1 = require("./commands/copy-context");
const export_report_1 = require("./commands/export-report");
let lastSuiteResult;
function activate(context) {
    console.log('[MRCP-Engine] Extensão ativada com sucesso!');
    // 1. Initialize Providers
    const quickActionsProvider = new tree_data_provider_1.MrcpQuickActionsProvider();
    const healthProvider = new tree_data_provider_1.MrcpHealthProvider();
    const securityProvider = new tree_data_provider_1.MrcpSecurityProvider();
    const architectureProvider = new tree_data_provider_1.MrcpArchitectureProvider();
    const qualityProvider = new tree_data_provider_1.MrcpQualityProvider();
    const documentProvider = new tree_data_provider_1.MrcpDocumentProvider();
    const codeLensProvider = new codelens_provider_1.MrcpCodeLensProvider();
    const diagnosticsProvider = new diagnostics_provider_1.MrcpDiagnosticsProvider();
    const statusBar = new status_bar_1.MrcpStatusBar();
    // 2. Register Tree Views
    vscode.window.registerTreeDataProvider('mrcp.views.quickActions', quickActionsProvider);
    vscode.window.registerTreeDataProvider('mrcp.views.health', healthProvider);
    vscode.window.registerTreeDataProvider('mrcp.views.security', securityProvider);
    vscode.window.registerTreeDataProvider('mrcp.views.architecture', architectureProvider);
    vscode.window.registerTreeDataProvider('mrcp.views.quality', qualityProvider);
    vscode.window.registerTreeDataProvider('mrcp.views.documents', documentProvider);
    // 3. Register CodeLens
    const supportedLanguages = [
        'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
        'python', 'go', 'rust', 'java', 'c', 'cpp', 'php', 'ruby', 'csharp'
    ];
    for (const lang of supportedLanguages) {
        context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: lang, scheme: 'file' }, codeLensProvider));
    }
    // 4. Command Context Pack
    const cmdContext = {
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
        setLastResult: (res) => { lastSuiteResult = res; }
    };
    // 5. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('mrcp.runFullSuite', () => (0, run_suite_1.runFullSuiteCommand)(cmdContext)), vscode.commands.registerCommand('mrcp.openDashboard', () => {
        dashboard_panel_1.MrcpDashboardPanel.createOrShow(context.extensionUri, lastSuiteResult);
    }), vscode.commands.registerCommand('mrcp.copyAiContext', () => (0, copy_context_1.copyAiContextCommand)(cmdContext)), vscode.commands.registerCommand('mrcp.copyFileContext', () => (0, copy_context_1.copyFileContextCommand)(cmdContext)), vscode.commands.registerCommand('mrcp.auditSecurity', async () => {
        if (!lastSuiteResult) {
            await (0, run_suite_1.runFullSuiteCommand)(cmdContext);
        }
        vscode.commands.executeCommand('mrcp.views.security.focus');
    }), vscode.commands.registerCommand('mrcp.detectDeadCode', async () => {
        if (!lastSuiteResult) {
            await (0, run_suite_1.runFullSuiteCommand)(cmdContext);
        }
        vscode.commands.executeCommand('mrcp.views.quality.focus');
    }), vscode.commands.registerCommand('mrcp.validateEnv', async () => {
        if (!lastSuiteResult) {
            await (0, run_suite_1.runFullSuiteCommand)(cmdContext);
        }
        vscode.commands.executeCommand('mrcp.views.security.focus');
    }), vscode.commands.registerCommand('mrcp.exportReport', () => (0, export_report_1.exportReportCommand)(cmdContext)), vscode.commands.registerCommand('mrcp.refresh', () => (0, run_suite_1.runFullSuiteCommand)(cmdContext)), vscode.commands.registerCommand('mrcp.openFileAtLocation', async (filePath, line) => {
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            const editor = await vscode.window.showTextDocument(doc, { preview: true });
            const targetLine = Math.max(0, (line || 1) - 1);
            const position = new vscode.Position(targetLine, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Não foi possível abrir o arquivo: ${filePath}`);
        }
    }));
    // 6. Watchers / Auto-Analyze on save (if configured)
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
        const config = vscode.workspace.getConfiguration('mrcp');
        if (config.get('autoAnalyzeOnSave', false)) {
            if (supportedLanguages.includes(doc.languageId)) {
                (0, run_suite_1.runFullSuiteCommand)(cmdContext);
            }
        }
    }));
    // 7. Cleanup subscriptions
    context.subscriptions.push(statusBar);
    context.subscriptions.push({ dispose: () => diagnosticsProvider.dispose() });
    // Optional: Trigger initial background scan on startup if workspace is open
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        // Light initial delay to allow VS Code to settle
        setTimeout(() => {
            (0, run_suite_1.runFullSuiteCommand)(cmdContext);
        }, 1500);
    }
}
function deactivate() {
    if (dashboard_panel_1.MrcpDashboardPanel.currentPanel) {
        dashboard_panel_1.MrcpDashboardPanel.currentPanel.dispose();
    }
}
//# sourceMappingURL=extension.js.map