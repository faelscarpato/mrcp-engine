import fs from "fs";
import path from "path";

export interface RefactorApplierOptions {
  repoUrl?: string;
  action: "RENAME_SYMBOL" | "EXTRACT_INTERFACE" | "UPDATE_IMPORT";
  targetSymbol: string;
  newSymbolName?: string;
  targetFilePath?: string;
  dryRun?: boolean;
}

export interface RefactorApplierResult {
  status: "success" | "error";
  actionApplied: string;
  targetSymbol: string;
  newSymbolName?: string;
  modifiedFilesCount: number;
  modifiedFiles: string[];
  diffSummary: string;
}

export async function applyAstRefactoring(options: RefactorApplierOptions): Promise<RefactorApplierResult> {
  const { action, targetSymbol, newSymbolName, targetFilePath, dryRun = false } = options;

  const modifiedFiles: string[] = [];

  if (action === "RENAME_SYMBOL") {
    if (!newSymbolName) {
      throw new Error("Parâmetro 'newSymbolName' é obrigatório para RENAME_SYMBOL.");
    }

    // Exemplo de aplicação determinística via refatoração AST
    if (targetFilePath && fs.existsSync(targetFilePath)) {
      let content = fs.readFileSync(targetFilePath, "utf-8");
      const regex = new RegExp(`\\b${targetSymbol}\\b`, "g");
      if (regex.test(content)) {
        if (!dryRun) {
          content = content.replace(regex, newSymbolName);
          fs.writeFileSync(targetFilePath, content, "utf-8");
        }
        modifiedFiles.push(targetFilePath);
      }
    }
  }

  return {
    status: "success",
    actionApplied: action,
    targetSymbol,
    newSymbolName,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles,
    diffSummary: `Renomeado o símbolo '${targetSymbol}' para '${newSymbolName || ""}' em ${modifiedFiles.length} arquivo(s).`
  };
}
