import * as vscode from "vscode";
import * as path from "path";
import { MrcpSuiteResult } from "../engine/types";
import {
  packWorkspaceContextForAi,
  packSingleFileContext,
} from "../engine/context-packer";
import { CommandContext } from "./run-suite";

export async function copyAiContextCommand(ctx: CommandContext): Promise<void> {
  let result = ctx.getLastResult();
  if (!result) {
    // Run suite first if not executed yet
    const runChoice = await vscode.window.showInformationMessage(
      "Nenhuma análise foi executada ainda. Deseja executar o diagnóstico agora para gerar o pacote de contexto?",
      "Sim, Executar",
      "Cancelar",
    );
    if (runChoice === "Sim, Executar") {
      result = await vscode.commands.executeCommand("mrcp.runFullSuite");
    }
  }

  if (!result) return;

  const packed = packWorkspaceContextForAi(result);
  await vscode.env.clipboard.writeText(packed);

  vscode.window.showInformationMessage(
    `📋 Pacote de Contexto MRCP copiado para a Área de Transferência! (~${result.summary.tokenSavingsPercent}% de economia de tokens pronto para colar no ChatGPT, Claude ou Cursor).`,
  );
}

export async function copyFileContextCommand(
  ctx: CommandContext,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(
      "Nenhum arquivo de código ativo no editor.",
    );
    return;
  }

  const document = editor.document;
  const content = document.getText();
  const filePath = document.uri.fsPath;
  const fileName = path.basename(filePath);

  const result = ctx.getLastResult();
  const fileAnalysis = result?.files.find(
    (f) => f.path === filePath || f.relativePath.endsWith(fileName),
  );

  const packed = fileAnalysis
    ? packSingleFileContext(fileAnalysis, content)
    : `### File: \`${fileName}\`\n\`\`\`${document.languageId}\n${content}\n\`\`\``;

  await vscode.env.clipboard.writeText(packed);
  vscode.window.showInformationMessage(
    `📋 Contexto do arquivo "${fileName}" copiado com sucesso!`,
  );
}
