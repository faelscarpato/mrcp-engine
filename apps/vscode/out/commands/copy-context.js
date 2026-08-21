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
exports.copyAiContextCommand = copyAiContextCommand;
exports.copyFileContextCommand = copyFileContextCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const context_packer_1 = require("../engine/context-packer");
async function copyAiContextCommand(ctx) {
    let result = ctx.getLastResult();
    if (!result) {
        // Run suite first if not executed yet
        const runChoice = await vscode.window.showInformationMessage('Nenhuma análise foi executada ainda. Deseja executar o diagnóstico agora para gerar o pacote de contexto?', 'Sim, Executar', 'Cancelar');
        if (runChoice === 'Sim, Executar') {
            result = await vscode.commands.executeCommand('mrcp.runFullSuite');
        }
    }
    if (!result)
        return;
    const packed = (0, context_packer_1.packWorkspaceContextForAi)(result);
    await vscode.env.clipboard.writeText(packed);
    vscode.window.showInformationMessage(`📋 Pacote de Contexto MRCP copiado para a Área de Transferência! (~${result.summary.tokenSavingsPercent}% de economia de tokens pronto para colar no ChatGPT, Claude ou Cursor).`);
}
async function copyFileContextCommand(ctx) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Nenhum arquivo de código ativo no editor.');
        return;
    }
    const document = editor.document;
    const content = document.getText();
    const filePath = document.uri.fsPath;
    const fileName = path.basename(filePath);
    const result = ctx.getLastResult();
    const fileAnalysis = result?.files.find(f => f.path === filePath || f.relativePath.endsWith(fileName));
    const packed = fileAnalysis
        ? (0, context_packer_1.packSingleFileContext)(fileAnalysis, content)
        : `### File: \`${fileName}\`\n\`\`\`${document.languageId}\n${content}\n\`\`\``;
    await vscode.env.clipboard.writeText(packed);
    vscode.window.showInformationMessage(`📋 Contexto do arquivo "${fileName}" copiado com sucesso!`);
}
//# sourceMappingURL=copy-context.js.map