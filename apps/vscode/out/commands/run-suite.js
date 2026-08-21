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
exports.runFullSuiteCommand = runFullSuiteCommand;
const vscode = __importStar(require("vscode"));
const local_analyzer_1 = require("../engine/local-analyzer");
const dashboard_panel_1 = require("../webview/dashboard-panel");
async function runFullSuiteCommand(ctx) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('Nenhum workspace ou pasta aberta no VS Code.');
        return undefined;
    }
    const rootPath = folders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('mrcp');
    const maxFiles = config.get('maxFiles', 2000);
    ctx.statusBar.setAnalyzing('Escaneando...');
    return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'MRCP Engine: Executando Diagnóstico do Workspace',
        cancellable: false
    }, async (progress) => {
        try {
            let lastPct = 0;
            const result = await (0, local_analyzer_1.analyzeWorkspaceLocally)(rootPath, maxFiles, (pct, msg) => {
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
            if (dashboard_panel_1.MrcpDashboardPanel.currentPanel) {
                dashboard_panel_1.MrcpDashboardPanel.currentPanel.update(result);
            }
            const msg = `✅ MRCP: Diagnóstico concluído! Saúde: ${result.summary.healthScore}/100 (Nota ${result.summary.letterGrade}) | Economia de Tokens: ~${result.summary.tokenSavingsPercent}%`;
            vscode.window.showInformationMessage(msg, 'Abrir Cockpit', 'Copiar Contexto IA').then((action) => {
                if (action === 'Abrir Cockpit') {
                    vscode.commands.executeCommand('mrcp.openDashboard');
                }
                else if (action === 'Copiar Contexto IA') {
                    vscode.commands.executeCommand('mrcp.copyAiContext');
                }
            });
            return result;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Erro durante análise MRCP: ${err.message}`);
            ctx.statusBar.dispose();
            return undefined;
        }
    });
}
//# sourceMappingURL=run-suite.js.map