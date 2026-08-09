import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "mrcp-vscode" is now active!');

    let disposable = vscode.commands.registerCommand('mrcp.analyze', () => {
        vscode.window.showInformationMessage('Iniciando análise MRCP...');
        // TODO: Integração com o mrcp-engine-bridge para exibir o grafo AST no painel
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
