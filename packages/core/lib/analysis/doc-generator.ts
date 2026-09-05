import { findRepoFiles, fetchRepoFile } from "./repo-fetcher.js";

export interface UndocumentedSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "method";
  filePath: string;
  line: number;
  signature: string;
  generatedDocstring: string;
}

export interface DocGeneratorOptions {
  repoUrl: string;
  targetFilePath?: string;
  format?: "TSDOC" | "JSDOC" | "PYTHON_DOCSTRING" | "MARKDOWN";
}

export interface DocGeneratorResult {
  repoUrl: string;
  totalUndocumentedSymbols: number;
  symbols: UndocumentedSymbol[];
  markdownApiReference: string;
  isApplicable: boolean;
  message?: string;
}

export async function generateDocumentation(
  options: DocGeneratorOptions,
): Promise<DocGeneratorResult> {
  const { repoUrl, targetFilePath, format = "TSDOC" } = options;

  const files = await findRepoFiles(repoUrl, (filePath) => {
    if (targetFilePath && filePath !== targetFilePath) return false;
    const p = filePath.toLowerCase();
    return (
      (p.endsWith(".ts") ||
        p.endsWith(".tsx") ||
        p.endsWith(".js") ||
        p.endsWith(".py")) &&
      !p.includes("node_modules") &&
      !p.includes(".test.") &&
      !p.includes(".spec.") &&
      !p.includes("dist/")
    );
  });

  const undocumentedSymbols: UndocumentedSymbol[] = [];
  const markdownRows: string[] = [
    `# 📚 API Reference for ${repoUrl}`,
    ``,
    `| Symbol | Type | File | Description |`,
    `| :--- | :--- | :--- | :--- |`,
  ];

  for (const filePath of files) {
    const file = await fetchRepoFile(repoUrl, filePath);
    if (!file || !file.content) continue;

    const content = file.content;
    const lines = content.split("\n");

    // TypeScript / JavaScript export analysis
    if (
      filePath.endsWith(".ts") ||
      filePath.endsWith(".tsx") ||
      filePath.endsWith(".js")
    ) {
      const exportFuncRegex =
        /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)\s*(\([^)]*\))(?:\s*:\s*([^{]+))?/g;
      let m;
      while ((m = exportFuncRegex.exec(content)) !== null) {
        const funcName = m[2];
        const paramsStr = m[3];
        const returnType = (m[4] || "void").trim();
        const lineNum = content.slice(0, m.index).split("\n").length;

        // Check if there is already a JSDoc before this line
        const prevLines = lines
          .slice(Math.max(0, lineNum - 5), lineNum - 1)
          .join("\n");
        const hasDoc = prevLines.includes("*/") || prevLines.includes("/**");

        if (!hasDoc) {
          const docstring = buildTsDoc(funcName, paramsStr, returnType);
          undocumentedSymbols.push({
            name: funcName,
            kind: "function",
            filePath,
            line: lineNum,
            signature: `export ${m[1] || ""}function ${funcName}${paramsStr}: ${returnType}`,
            generatedDocstring: docstring,
          });
          markdownRows.push(
            `| \`${funcName}\` | Function | \`${filePath}:${lineNum}\` | Automated export documentation |`,
          );
        }
      }

      // Interfaces
      const ifaceRegex = /export\s+interface\s+([a-zA-Z0-9_]+)/g;
      let im;
      while ((im = ifaceRegex.exec(content)) !== null) {
        const ifaceName = im[1];
        const lineNum = content.slice(0, im.index).split("\n").length;
        const prevLines = lines
          .slice(Math.max(0, lineNum - 4), lineNum - 1)
          .join("\n");
        if (!prevLines.includes("*/") && !prevLines.includes("/**")) {
          const doc = `/**\n * Represents the contract and data model for ${ifaceName}.\n */`;
          undocumentedSymbols.push({
            name: ifaceName,
            kind: "interface",
            filePath,
            line: lineNum,
            signature: `export interface ${ifaceName}`,
            generatedDocstring: doc,
          });
          markdownRows.push(
            `| \`${ifaceName}\` | Interface | \`${filePath}:${lineNum}\` | Interface data contract |`,
          );
        }
      }
    }

    // Python def / class analysis
    if (filePath.endsWith(".py")) {
      const pyFuncRegex =
        /def\s+([a-zA-Z0-9_]+)\s*(\([^)]*\))(?:\s*->\s*([^:]+))?:/g;
      let pm;
      while ((pm = pyFuncRegex.exec(content)) !== null) {
        const funcName = pm[1];
        if (funcName.startsWith("_") && !funcName.startsWith("__init__"))
          continue;
        const paramsStr = pm[2];
        const returnType = (pm[3] || "None").trim();
        const lineNum = content.slice(0, pm.index).split("\n").length;

        const nextLines = lines.slice(lineNum, lineNum + 4).join("\n");
        const hasDoc = nextLines.includes('"""') || nextLines.includes("'''");

        if (!hasDoc) {
          const doc = buildPyDoc(funcName, paramsStr, returnType);
          undocumentedSymbols.push({
            name: funcName,
            kind: "function",
            filePath,
            line: lineNum,
            signature: `def ${funcName}${paramsStr} -> ${returnType}:`,
            generatedDocstring: doc,
          });
          markdownRows.push(
            `| \`${funcName}\` | Python Function | \`${filePath}:${lineNum}\` | Function documentation |`,
          );
        }
      }
    }
  }

  const isApplicable = undocumentedSymbols.length > 0;

  return {
    repoUrl,
    totalUndocumentedSymbols: undocumentedSymbols.length,
    symbols: undocumentedSymbols.slice(0, 100),
    markdownApiReference: markdownRows.join("\n"),
    isApplicable,
    message: isApplicable
      ? `Localizados ${undocumentedSymbols.length} símbolos públicos sem documentação. Geradas anotações TSDoc/JSDoc e tabela Markdown.`
      : "Todos os símbolos públicos analisados já contam com documentação ou não foram encontrados símbolos exportados.",
  };
}

function buildTsDoc(
  funcName: string,
  paramsStr: string,
  returnType: string,
): string {
  const cleanParams = paramsStr.replace(/[()]/g, "").trim();
  const docLines: string[] = [`/**`, ` * ${humanizeName(funcName)}.`, ` *`];

  if (cleanParams) {
    const rawParams = cleanParams.split(",");
    for (const p of rawParams) {
      const parts = p.trim().split(":");
      const pName = parts[0]?.trim();
      const pType = parts[1]?.trim() || "any";
      if (pName) {
        docLines.push(
          ` * @param {${pType}} ${pName} - Parameter description for ${pName}`,
        );
      }
    }
  }

  docLines.push(` * @returns {${returnType}} - Output result`);
  docLines.push(` */`);
  return docLines.join("\n");
}

function buildPyDoc(
  funcName: string,
  paramsStr: string,
  returnType: string,
): string {
  const cleanParams = paramsStr.replace(/[()]/g, "").trim();
  const docLines: string[] = [
    `    """${humanizeName(funcName)}.`,
    ``,
    `    Args:`,
  ];

  if (cleanParams) {
    for (const p of cleanParams.split(",")) {
      const pName = p.trim().split(":")[0]?.trim();
      if (pName && pName !== "self" && pName !== "cls") {
        docLines.push(`        ${pName}: Description for ${pName}.`);
      }
    }
  } else {
    docLines.push(`        None.`);
  }

  docLines.push(``);
  docLines.push(`    Returns:`);
  docLines.push(`        ${returnType}: Resulting value.`);
  docLines.push(`    """`);
  return docLines.join("\n");
}

function humanizeName(name: string): string {
  const words = name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
