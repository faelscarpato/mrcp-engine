<<<<<<< HEAD
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
  status: "success" | "warning" | "not_found" | "error";
  isApplicable: boolean;
  message?: string;
  actionApplied: string;
  targetSymbol: string;
  newSymbolName?: string;
  targetFilePath?: string;
  modifiedFilesCount: number;
  modifiedFiles: string[];
  diffSummary: string;
  dryRun: boolean;
  warnings: string[];
}

export async function applyAstRefactoring(options: RefactorApplierOptions): Promise<RefactorApplierResult> {
  const { action, targetSymbol, newSymbolName, targetFilePath, dryRun = true } = options;
  const warnings: string[] = [];
  const modifiedFiles: string[] = [];

  if (!targetSymbol) {
    return {
      status: "error",
      isApplicable: false,
      message: "Não se aplica: 'targetSymbol' é obrigatório.",
      actionApplied: action,
      targetSymbol: "",
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: ["targetSymbol não informado."]
    };
  }

  // 1. Validação de arquivo alvo
  if (!targetFilePath) {
    return {
      status: "warning",
      isApplicable: false,
      message: "Não se aplica: 'targetFilePath' deve ser especificado para aplicar a refatoração.",
      actionApplied: action,
      targetSymbol,
      newSymbolName,
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: ["targetFilePath não informado."]
    };
  }

  const resolvedPath = path.resolve(targetFilePath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      status: "not_found",
      isApplicable: false,
      message: `Não se aplica: Arquivo '${targetFilePath}' não foi encontrado no disco.`,
      actionApplied: action,
      targetSymbol,
      newSymbolName,
      targetFilePath,
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: [`Arquivo '${targetFilePath}' não existe.`]
    };
  }

  let originalContent = "";
  try {
    originalContent = await fs.promises.readFile(resolvedPath, "utf-8");
    if (originalContent.includes("\u0000")) {
      warnings.push(`Arquivo '${targetFilePath}' contém bytes nulos ou está corrompido.`);
    }
  } catch (err: any) {
    return {
      status: "error",
      isApplicable: false,
      message: `Erro ao ler arquivo '${targetFilePath}': ${err.message}`,
      actionApplied: action,
      targetSymbol,
      newSymbolName,
      targetFilePath,
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: [err.message]
    };
  }

  let updatedContent = originalContent;
  let diffSummary = "";

  // 2. Execução da ação AST
  if (action === "RENAME_SYMBOL") {
    if (!newSymbolName) {
      return {
        status: "error",
        isApplicable: false,
        message: "Parâmetro 'newSymbolName' é obrigatório para RENAME_SYMBOL.",
        actionApplied: action,
        targetSymbol,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings: ["newSymbolName ausente."]
      };
    }

    const regex = new RegExp(`\\b${targetSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const matchesCount = (originalContent.match(regex) || []).length;

    if (matchesCount === 0) {
      return {
        status: "not_found",
        isApplicable: false,
        message: `Não se aplica: O símbolo '${targetSymbol}' não foi encontrado no arquivo '${targetFilePath}'.`,
        actionApplied: action,
        targetSymbol,
        newSymbolName,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "Nenhuma ocorrência do símbolo encontrada.",
        dryRun,
        warnings
      };
    }

    updatedContent = originalContent.replace(regex, newSymbolName);
    diffSummary = `Renomeadas ${matchesCount} ocorrência(s) de '${targetSymbol}' para '${newSymbolName}' em ${targetFilePath}.${dryRun ? " (Simulação / Dry Run)" : " (Gravado em disco)"}`;
    modifiedFiles.push(targetFilePath);
  } else if (action === "EXTRACT_INTERFACE") {
    const interfaceName = newSymbolName || `I${targetSymbol}`;
    // Procura classe ou objeto
    const classRegex = new RegExp(`class\\s+${targetSymbol}\\b[^{]*\\{([\\s\\S]*?)\\}`, "m");
    const classMatch = originalContent.match(classRegex);

    if (!classMatch) {
      return {
        status: "not_found",
        isApplicable: false,
        message: `Não se aplica: Declaração de classe para '${targetSymbol}' não foi encontrada em '${targetFilePath}'.`,
        actionApplied: action,
        targetSymbol,
        newSymbolName: interfaceName,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings
      };
    }

    const classBody = classMatch[1];
    // Extrai métodos públicos
    const methodMatches = Array.from(classBody.matchAll(/([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\{/g));
    const methods = methodMatches.map((m) => `  ${m[1]}(${m[2].trim()}): ${m[3] ? m[3].trim() : "any"};`);

    const interfaceCode = `export interface ${interfaceName} {\n${methods.length > 0 ? methods.join("\n") : "  // Propriedades e métodos da interface\n"}\n}\n\n`;
    updatedContent = `${interfaceCode}${originalContent}`;
    diffSummary = `Interface '${interfaceName}' extraída a partir de '${targetSymbol}' com ${methods.length} método(s).${dryRun ? " (Simulação)" : " (Gravado)"}`;
    modifiedFiles.push(targetFilePath);
  } else if (action === "UPDATE_IMPORT") {
    const newImportPath = newSymbolName || "";
    if (!newImportPath) {
      return {
        status: "error",
        isApplicable: false,
        message: "Parâmetro 'newSymbolName' (novo caminho do import) é obrigatório.",
        actionApplied: action,
        targetSymbol,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings
      };
    }

    const importRegex = new RegExp(`(import\\s+.*?\\s+from\\s+['"])${targetSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(['"])`, "g");
    if (!importRegex.test(originalContent)) {
      return {
        status: "not_found",
        isApplicable: false,
        message: `Não se aplica: Nenhuma instrução de importação contendo '${targetSymbol}' foi encontrada em '${targetFilePath}'.`,
        actionApplied: action,
        targetSymbol,
        newSymbolName: newImportPath,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings
      };
    }

    updatedContent = originalContent.replace(importRegex, `$1${newImportPath}$2`);
    diffSummary = `Caminho do import atualizado de '${targetSymbol}' para '${newImportPath}'.${dryRun ? " (Simulação)" : " (Gravado)"}`;
    modifiedFiles.push(targetFilePath);
  }

  // 3. Aplicação em disco caso dryRun seja false
  if (!dryRun && modifiedFiles.length > 0) {
    try {
      await fs.promises.writeFile(resolvedPath, updatedContent, "utf-8");
    } catch (err: any) {
      warnings.push(`Erro ao gravar alterações em '${targetFilePath}': ${err.message}`);
    }
  }

  return {
    status: "success",
    isApplicable: true,
    actionApplied: action,
    targetSymbol,
    newSymbolName,
    targetFilePath,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles,
    diffSummary,
    dryRun,
    warnings
  };
}
=======
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
<<<<<<< HEAD
  status: "success" | "warning" | "not_found" | "error";
  isApplicable: boolean;
  message?: string;
  actionApplied: string;
  targetSymbol: string;
  newSymbolName?: string;
  targetFilePath?: string;
  modifiedFilesCount: number;
  modifiedFiles: string[];
  diffSummary: string;
  dryRun: boolean;
  warnings: string[];
}

export async function applyAstRefactoring(options: RefactorApplierOptions): Promise<RefactorApplierResult> {
  const { action, targetSymbol, newSymbolName, targetFilePath, dryRun = true } = options;
  const warnings: string[] = [];
  const modifiedFiles: string[] = [];

  if (!targetSymbol) {
    return {
      status: "error",
      isApplicable: false,
      message: "Não se aplica: 'targetSymbol' é obrigatório.",
      actionApplied: action,
      targetSymbol: "",
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: ["targetSymbol não informado."]
    };
  }

  // 1. Validação de arquivo alvo
  if (!targetFilePath) {
    return {
      status: "warning",
      isApplicable: false,
      message: "Não se aplica: 'targetFilePath' deve ser especificado para aplicar a refatoração.",
      actionApplied: action,
      targetSymbol,
      newSymbolName,
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: ["targetFilePath não informado."]
    };
  }

  const resolvedPath = path.resolve(targetFilePath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      status: "not_found",
      isApplicable: false,
      message: `Não se aplica: Arquivo '${targetFilePath}' não foi encontrado no disco.`,
      actionApplied: action,
      targetSymbol,
      newSymbolName,
      targetFilePath,
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: [`Arquivo '${targetFilePath}' não existe.`]
    };
  }

  let originalContent = "";
  try {
    originalContent = await fs.promises.readFile(resolvedPath, "utf-8");
    if (originalContent.includes("\u0000")) {
      warnings.push(`Arquivo '${targetFilePath}' contém bytes nulos ou está corrompido.`);
    }
  } catch (err: any) {
    return {
      status: "error",
      isApplicable: false,
      message: `Erro ao ler arquivo '${targetFilePath}': ${err.message}`,
      actionApplied: action,
      targetSymbol,
      newSymbolName,
      targetFilePath,
      modifiedFilesCount: 0,
      modifiedFiles: [],
      diffSummary: "",
      dryRun,
      warnings: [err.message]
    };
  }

  let updatedContent = originalContent;
  let diffSummary = "";

  // 2. Execução da ação AST
  if (action === "RENAME_SYMBOL") {
    if (!newSymbolName) {
      return {
        status: "error",
        isApplicable: false,
        message: "Parâmetro 'newSymbolName' é obrigatório para RENAME_SYMBOL.",
        actionApplied: action,
        targetSymbol,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings: ["newSymbolName ausente."]
      };
    }

    const regex = new RegExp(`\\b${targetSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const matchesCount = (originalContent.match(regex) || []).length;

    if (matchesCount === 0) {
      return {
        status: "not_found",
        isApplicable: false,
        message: `Não se aplica: O símbolo '${targetSymbol}' não foi encontrado no arquivo '${targetFilePath}'.`,
        actionApplied: action,
        targetSymbol,
        newSymbolName,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "Nenhuma ocorrência do símbolo encontrada.",
        dryRun,
        warnings
      };
    }

    updatedContent = originalContent.replace(regex, newSymbolName);
    diffSummary = `Renomeadas ${matchesCount} ocorrência(s) de '${targetSymbol}' para '${newSymbolName}' em ${targetFilePath}.${dryRun ? " (Simulação / Dry Run)" : " (Gravado em disco)"}`;
    modifiedFiles.push(targetFilePath);
  } else if (action === "EXTRACT_INTERFACE") {
    const interfaceName = newSymbolName || `I${targetSymbol}`;
    // Procura classe ou objeto
    const classRegex = new RegExp(`class\\s+${targetSymbol}\\b[^{]*\\{([\\s\\S]*?)\\}`, "m");
    const classMatch = originalContent.match(classRegex);

    if (!classMatch) {
      return {
        status: "not_found",
        isApplicable: false,
        message: `Não se aplica: Declaração de classe para '${targetSymbol}' não foi encontrada em '${targetFilePath}'.`,
        actionApplied: action,
        targetSymbol,
        newSymbolName: interfaceName,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings
      };
    }

    const classBody = classMatch[1];
    // Extrai métodos públicos
    const methodMatches = Array.from(classBody.matchAll(/([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\{/g));
    const methods = methodMatches.map((m) => `  ${m[1]}(${m[2].trim()}): ${m[3] ? m[3].trim() : "any"};`);

    const interfaceCode = `export interface ${interfaceName} {\n${methods.length > 0 ? methods.join("\n") : "  // Propriedades e métodos da interface\n"}\n}\n\n`;
    updatedContent = `${interfaceCode}${originalContent}`;
    diffSummary = `Interface '${interfaceName}' extraída a partir de '${targetSymbol}' com ${methods.length} método(s).${dryRun ? " (Simulação)" : " (Gravado)"}`;
    modifiedFiles.push(targetFilePath);
  } else if (action === "UPDATE_IMPORT") {
    const newImportPath = newSymbolName || "";
    if (!newImportPath) {
      return {
        status: "error",
        isApplicable: false,
        message: "Parâmetro 'newSymbolName' (novo caminho do import) é obrigatório.",
        actionApplied: action,
        targetSymbol,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings
      };
    }

    const importRegex = new RegExp(`(import\\s+.*?\\s+from\\s+['"])${targetSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(['"])`, "g");
    if (!importRegex.test(originalContent)) {
      return {
        status: "not_found",
        isApplicable: false,
        message: `Não se aplica: Nenhuma instrução de importação contendo '${targetSymbol}' foi encontrada em '${targetFilePath}'.`,
        actionApplied: action,
        targetSymbol,
        newSymbolName: newImportPath,
        targetFilePath,
        modifiedFilesCount: 0,
        modifiedFiles: [],
        diffSummary: "",
        dryRun,
        warnings
      };
    }

    updatedContent = originalContent.replace(importRegex, `$1${newImportPath}$2`);
    diffSummary = `Caminho do import atualizado de '${targetSymbol}' para '${newImportPath}'.${dryRun ? " (Simulação)" : " (Gravado)"}`;
    modifiedFiles.push(targetFilePath);
  }

  // 3. Aplicação em disco caso dryRun seja false
  if (!dryRun && modifiedFiles.length > 0) {
    try {
      await fs.promises.writeFile(resolvedPath, updatedContent, "utf-8");
    } catch (err: any) {
      warnings.push(`Erro ao gravar alterações em '${targetFilePath}': ${err.message}`);
=======
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
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
    }
  }

  return {
    status: "success",
<<<<<<< HEAD
    isApplicable: true,
    actionApplied: action,
    targetSymbol,
    newSymbolName,
    targetFilePath,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles,
    diffSummary,
    dryRun,
    warnings
=======
    actionApplied: action,
    targetSymbol,
    newSymbolName,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles,
    diffSummary: `Renomeado o símbolo '${targetSymbol}' para '${newSymbolName || ""}' em ${modifiedFiles.length} arquivo(s).`
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  };
}
>>>>>>> d6b6b143eac7885322e1cb04fd8155dc5ebb9b9e
