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
exports.MrcpDiagnosticsProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class MrcpDiagnosticsProvider {
    diagnosticCollection;
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('mrcp');
    }
    update(result) {
        const config = vscode.workspace.getConfiguration('mrcp');
        if (!config.get('enableNativeDiagnostics', true)) {
            this.diagnosticCollection.clear();
            return;
        }
        this.diagnosticCollection.clear();
        const map = new Map();
        // 1. Security issues
        for (const sec of result.securityIssues) {
            const fullPath = path.join(result.workspaceRoot, sec.file);
            const uri = vscode.Uri.file(fullPath);
            const line = Math.max(0, sec.line - 1);
            const range = new vscode.Range(line, 0, line, 120);
            const severity = (sec.severity === 'critical' || sec.severity === 'high')
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning;
            const diagnostic = new vscode.Diagnostic(range, `[MRCP Security] ${sec.rule}: ${sec.message}`, severity);
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
            const diagnostic = new vscode.Diagnostic(range, `[MRCP Env] Variável process.env.${env.variableName} não está declarada no .env ou .env.example.`, vscode.DiagnosticSeverity.Warning);
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
    clear() {
        this.diagnosticCollection.clear();
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
exports.MrcpDiagnosticsProvider = MrcpDiagnosticsProvider;
//# sourceMappingURL=diagnostics-provider.js.map