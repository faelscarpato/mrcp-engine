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
exports.MrcpDashboardPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const dashboard_template_1 = require("./dashboard-template");
class MrcpDashboardPanel {
    static currentPanel;
    _panel;
    _extensionUri;
    _disposables = [];
    _latestResult;
    static createOrShow(extensionUri, result) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (MrcpDashboardPanel.currentPanel) {
            MrcpDashboardPanel.currentPanel._panel.reveal(column);
            if (result) {
                MrcpDashboardPanel.currentPanel.update(result);
            }
            return MrcpDashboardPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('mrcpDashboard', 'MRCP Cockpit & Grafo AST', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionUri.fsPath, 'resources'))]
        });
        MrcpDashboardPanel.currentPanel = new MrcpDashboardPanel(panel, extensionUri, result);
        return MrcpDashboardPanel.currentPanel;
    }
    constructor(panel, extensionUri, result) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._latestResult = result;
        this.update(result);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'runSuite':
                    vscode.commands.executeCommand('mrcp.runFullSuite');
                    break;
                case 'copyContext':
                    vscode.commands.executeCommand('mrcp.copyAiContext');
                    break;
                case 'exportReport':
                    vscode.commands.executeCommand('mrcp.exportReport');
                    break;
                case 'openFile':
                    if (message.file) {
                        const root = this._latestResult?.workspaceRoot || (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '');
                        const fullPath = path.isAbsolute(message.file) ? message.file : path.join(root, message.file);
                        vscode.commands.executeCommand('mrcp.openFileAtLocation', fullPath, message.line || 1);
                    }
                    break;
            }
        }, null, this._disposables);
    }
    update(result) {
        if (result) {
            this._latestResult = result;
        }
        this._panel.webview.html = (0, dashboard_template_1.getDashboardHtml)(this._latestResult);
    }
    dispose() {
        MrcpDashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x)
                x.dispose();
        }
    }
}
exports.MrcpDashboardPanel = MrcpDashboardPanel;
//# sourceMappingURL=dashboard-panel.js.map