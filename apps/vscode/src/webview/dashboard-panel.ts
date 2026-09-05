import * as vscode from "vscode";
import * as path from "path";
import { MrcpSuiteResult } from "../engine/types";
import { getDashboardHtml } from "./dashboard-template";

export class MrcpDashboardPanel {
  public static currentPanel: MrcpDashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _latestResult?: MrcpSuiteResult;

  public static createOrShow(
    extensionUri: vscode.Uri,
    result?: MrcpSuiteResult,
  ): MrcpDashboardPanel {
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

    const panel = vscode.window.createWebviewPanel(
      "mrcpDashboard",
      "MRCP Cockpit & Grafo AST",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, "resources")),
        ],
      },
    );

    MrcpDashboardPanel.currentPanel = new MrcpDashboardPanel(
      panel,
      extensionUri,
      result,
    );
    return MrcpDashboardPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    result?: MrcpSuiteResult,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._latestResult = result;

    this.update(result);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "runSuite":
            vscode.commands.executeCommand("mrcp.runFullSuite");
            break;
          case "copyContext":
            vscode.commands.executeCommand("mrcp.copyAiContext");
            break;
          case "exportReport":
            vscode.commands.executeCommand("mrcp.exportReport");
            break;
          case "openFile":
            if (message.file) {
              const root =
                this._latestResult?.workspaceRoot ||
                (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "");
              const fullPath = path.isAbsolute(message.file)
                ? message.file
                : path.join(root, message.file);
              vscode.commands.executeCommand(
                "mrcp.openFileAtLocation",
                fullPath,
                message.line || 1,
              );
            }
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  public update(result?: MrcpSuiteResult): void {
    if (result) {
      this._latestResult = result;
    }
    this._panel.webview.html = getDashboardHtml(this._latestResult);
  }

  public dispose(): void {
    MrcpDashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}
