<<<<<<< HEAD
import { fetchRepoFile, findRepoFiles } from "./repo-fetcher.js";

export interface TypeSignatureExtractorOptions {
  repoUrl: string;
  targetFilePath?: string;
}

export interface ExtractedTypeSignature {
  kind: "INTERFACE" | "TYPE_ALIAS" | "ENUM" | "FUNCTION_DECLARATION" | "CLASS_DECLARATION" | "STRUCT" | "TRAIT";
  name: string;
  filePath: string;
  signatureCode: string;
  line: number;
}

export interface TypeSignatureExtractorResult {
  repoUrl: string;
  targetFilePath?: string;
  isApplicable: boolean;
  message?: string;
  totalSignaturesCount: number;
  tokensSavedEstimate: number;
  signatures: ExtractedTypeSignature[];
  warnings: string[];
}

function extractSignaturesFromSource(content: string, filePath: string): ExtractedTypeSignature[] {
  const signatures: ExtractedTypeSignature[] = [];
  const lines = content.split("\n");
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  // 1. TypeScript (.ts, .tsx, .d.ts)
  if (ext === "ts" || ext === "tsx" || filePath.endsWith(".d.ts")) {
    // Interfaces
    const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = ifaceRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "INTERFACE",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }

    // Type aliases
    const typeRegex = /(?:export\s+)?type\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?\s*=\s*([^;\n]+(?:;|\n))/g;
    while ((match = typeRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "TYPE_ALIAS",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }

    // Enums
    const enumRegex = /(?:export\s+)?enum\s+([a-zA-Z0-9_$]+)\s*\{([\s\S]*?)\n\}/g;
    while ((match = enumRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "ENUM",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }

    // Exported function signatures (stripped bodies)
    const funcRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?\s*\(([\s\S]*?)\)(?:\s*:\s*([^{]+))?\s*\{/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const funcName = match[1];
      const params = match[2].trim().replace(/\s+/g, " ");
      const returnType = match[3] ? `: ${match[3].trim()}` : "";
      signatures.push({
        kind: "FUNCTION_DECLARATION",
        name: funcName,
        filePath,
        signatureCode: `export function ${funcName}(${params})${returnType};`,
        line
      });
    }

    // Exported classes (signature header only)
    const classRegex = /export\s+(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?\s*\{/g;
    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "CLASS_DECLARATION",
        name: match[1],
        filePath,
        signatureCode: `export declare class ${match[1]} { /* public methods & fields */ }`,
        line
      });
    }
  }

  // 2. Python (.py)
  else if (ext === "py") {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)(?:\(([^)]*)\))?:/);
      if (classMatch) {
        signatures.push({
          kind: "CLASS_DECLARATION",
          name: classMatch[1],
          filePath,
          signatureCode: line.trim(),
          line: i + 1
        });
      }
      const funcMatch = line.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (funcMatch) {
        signatures.push({
          kind: "FUNCTION_DECLARATION",
          name: funcMatch[1],
          filePath,
          signatureCode: line.trim(),
          line: i + 1
        });
      }
    }
  }

  // 3. Go (.go)
  else if (ext === "go") {
    const goIfaceRegex = /type\s+([a-zA-Z0-9_]+)\s+interface\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = goIfaceRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "INTERFACE",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
    const goStructRegex = /type\s+([a-zA-Z0-9_]+)\s+struct\s*\{([\s\S]*?)\n\}/g;
    while ((match = goStructRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "STRUCT",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
  }

  // 4. Rust (.rs)
  else if (ext === "rs") {
    const rustTraitRegex = /pub\s+trait\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = rustTraitRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "TRAIT",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
    const rustStructRegex = /pub\s+struct\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?\s*\{([\s\S]*?)\n\}/g;
    while ((match = rustStructRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "STRUCT",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
  }

  // 5. JavaScript (.js, .jsx, .mjs)
  else if (ext === "js" || ext === "jsx" || ext === "mjs") {
    // Classes ES6
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        signatures.push({
          kind: "CLASS_DECLARATION",
          name: classMatch[1],
          filePath,
          signatureCode: line.trim(),
          line: i + 1
        });
      }
      const funcMatch = line.match(/export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        signatures.push({
          kind: "FUNCTION_DECLARATION",
          name: funcMatch[1],
          filePath,
          signatureCode: `export function ${funcMatch[1]}(${funcMatch[2]});`,
          line: i + 1
        });
      }
    }
  }

  return signatures;
}

export async function extractTypeSignatures(
  options: TypeSignatureExtractorOptions
): Promise<TypeSignatureExtractorResult> {
  const { repoUrl, targetFilePath } = options;
  const warnings: string[] = [];
  const allSignatures: ExtractedTypeSignature[] = [];
  let totalRawChars = 0;

  // 1. Se um arquivo específico foi requisitado
  if (targetFilePath) {
    const fetched = await fetchRepoFile(repoUrl, targetFilePath);
    if (!fetched) {
      return {
        repoUrl,
        targetFilePath,
        isApplicable: false,
        message: `Não se aplica: O arquivo '${targetFilePath}' não foi encontrado no repositório.`,
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings: [`Arquivo '${targetFilePath}' inexistente.`]
      };
    }

    if (fetched.isCorrupted) {
      warnings.push(`Arquivo '${targetFilePath}' está corrompido ou contém bytes inválidos.`);
    }

    totalRawChars += fetched.content.length;
    const extracted = extractSignaturesFromSource(fetched.content, targetFilePath);
    allSignatures.push(...extracted);

    if (allSignatures.length === 0) {
      const ext = targetFilePath.split(".").pop()?.toLowerCase();
      const reason =
        ext === "js" || ext === "jsx"
          ? `O arquivo '${targetFilePath}' é JavaScript puro sem tipagens TypeScript ou interfaces exportadas.`
          : `Nenhuma interface, tipo ou declaração pública exportada foi encontrada em '${targetFilePath}'.`;

      return {
        repoUrl,
        targetFilePath,
        isApplicable: false,
        message: `Não se aplica a esse arquivo: ${reason}`,
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings
      };
    }
  }

  // 2. Se nenhum arquivo foi especificado, escaneia os principais arquivos de código do repositório
  else {
    const files = await findRepoFiles(repoUrl, (p) => {
      const ext = p.split(".").pop()?.toLowerCase() || "";
      return ["ts", "tsx", "py", "go", "rs", "js", "jsx"].includes(ext) && !p.includes(".test.") && !p.includes(".spec.");
    });

    if (files.length === 0) {
      return {
        repoUrl,
        isApplicable: false,
        message: "Não se aplica a esse repositório: Nenhum arquivo de código-fonte suportado foi encontrado.",
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings
      };
    }

    const maxFilesToScan = files.slice(0, 15);
    for (const filePath of maxFilesToScan) {
      const fetched = await fetchRepoFile(repoUrl, filePath);
      if (fetched && fetched.content) {
        if (fetched.isCorrupted) {
          warnings.push(`Arquivo '${filePath}' está corrompido.`);
        }
        totalRawChars += fetched.content.length;
        const extracted = extractSignaturesFromSource(fetched.content, filePath);
        allSignatures.push(...extracted);
      }
    }

    if (allSignatures.length === 0) {
      return {
        repoUrl,
        isApplicable: false,
        message: "Não se aplica a esse repositório: Nenhuma assinatura de tipo ou interface TypeScript/AST foi encontrada nos arquivos analisados.",
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings
      };
    }
  }

  // 3. Cálculo de economia de tokens real
  const signatureChars = allSignatures.reduce((acc, s) => acc + s.signatureCode.length, 0);
  const tokensSavedEstimate = Math.max(0, Math.round((totalRawChars - signatureChars) / 4));

  return {
    repoUrl,
    targetFilePath,
    isApplicable: true,
    totalSignaturesCount: allSignatures.length,
    tokensSavedEstimate,
    signatures: allSignatures,
    warnings
  };
}
=======
<<<<<<< HEAD
import { fetchRepoFile, findRepoFiles } from "./repo-fetcher.js";
=======
import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407

export interface TypeSignatureExtractorOptions {
  repoUrl: string;
  targetFilePath?: string;
}

export interface ExtractedTypeSignature {
<<<<<<< HEAD
  kind: "INTERFACE" | "TYPE_ALIAS" | "ENUM" | "FUNCTION_DECLARATION" | "CLASS_DECLARATION" | "STRUCT" | "TRAIT";
  name: string;
  filePath: string;
=======
  kind: "INTERFACE" | "TYPE_ALIAS" | "FUNCTION_DECLARATION" | "CLASS_DECLARATION";
  name: string;
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  signatureCode: string;
  line: number;
}

export interface TypeSignatureExtractorResult {
  repoUrl: string;
  targetFilePath?: string;
<<<<<<< HEAD
  isApplicable: boolean;
  message?: string;
  totalSignaturesCount: number;
  tokensSavedEstimate: number;
  signatures: ExtractedTypeSignature[];
  warnings: string[];
}

function extractSignaturesFromSource(content: string, filePath: string): ExtractedTypeSignature[] {
  const signatures: ExtractedTypeSignature[] = [];
  const lines = content.split("\n");
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  // 1. TypeScript (.ts, .tsx, .d.ts)
  if (ext === "ts" || ext === "tsx" || filePath.endsWith(".d.ts")) {
    // Interfaces
    const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = ifaceRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "INTERFACE",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }

    // Type aliases
    const typeRegex = /(?:export\s+)?type\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?\s*=\s*([^;\n]+(?:;|\n))/g;
    while ((match = typeRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "TYPE_ALIAS",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }

    // Enums
    const enumRegex = /(?:export\s+)?enum\s+([a-zA-Z0-9_$]+)\s*\{([\s\S]*?)\n\}/g;
    while ((match = enumRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "ENUM",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }

    // Exported function signatures (stripped bodies)
    const funcRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?\s*\(([\s\S]*?)\)(?:\s*:\s*([^{]+))?\s*\{/g;
    while ((match = funcRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const funcName = match[1];
      const params = match[2].trim().replace(/\s+/g, " ");
      const returnType = match[3] ? `: ${match[3].trim()}` : "";
      signatures.push({
        kind: "FUNCTION_DECLARATION",
        name: funcName,
        filePath,
        signatureCode: `export function ${funcName}(${params})${returnType};`,
        line
      });
    }

    // Exported classes (signature header only)
    const classRegex = /export\s+(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?\s*\{/g;
    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "CLASS_DECLARATION",
        name: match[1],
        filePath,
        signatureCode: `export declare class ${match[1]} { /* public methods & fields */ }`,
        line
      });
    }
  }

  // 2. Python (.py)
  else if (ext === "py") {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)(?:\(([^)]*)\))?:/);
      if (classMatch) {
        signatures.push({
          kind: "CLASS_DECLARATION",
          name: classMatch[1],
          filePath,
          signatureCode: line.trim(),
          line: i + 1
        });
      }
      const funcMatch = line.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (funcMatch) {
        signatures.push({
          kind: "FUNCTION_DECLARATION",
          name: funcMatch[1],
          filePath,
          signatureCode: line.trim(),
          line: i + 1
        });
      }
    }
  }

  // 3. Go (.go)
  else if (ext === "go") {
    const goIfaceRegex = /type\s+([a-zA-Z0-9_]+)\s+interface\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = goIfaceRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "INTERFACE",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
    const goStructRegex = /type\s+([a-zA-Z0-9_]+)\s+struct\s*\{([\s\S]*?)\n\}/g;
    while ((match = goStructRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "STRUCT",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
  }

  // 4. Rust (.rs)
  else if (ext === "rs") {
    const rustTraitRegex = /pub\s+trait\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = rustTraitRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "TRAIT",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
    const rustStructRegex = /pub\s+struct\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?\s*\{([\s\S]*?)\n\}/g;
    while ((match = rustStructRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      signatures.push({
        kind: "STRUCT",
        name: match[1],
        filePath,
        signatureCode: match[0].trim(),
        line
      });
    }
  }

  // 5. JavaScript (.js, .jsx, .mjs)
  else if (ext === "js" || ext === "jsx" || ext === "mjs") {
    // Classes ES6
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        signatures.push({
          kind: "CLASS_DECLARATION",
          name: classMatch[1],
          filePath,
          signatureCode: line.trim(),
          line: i + 1
        });
      }
      const funcMatch = line.match(/export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        signatures.push({
          kind: "FUNCTION_DECLARATION",
          name: funcMatch[1],
          filePath,
          signatureCode: `export function ${funcMatch[1]}(${funcMatch[2]});`,
          line: i + 1
        });
      }
    }
  }

  return signatures;
}

export async function extractTypeSignatures(
  options: TypeSignatureExtractorOptions
): Promise<TypeSignatureExtractorResult> {
  const { repoUrl, targetFilePath } = options;
  const warnings: string[] = [];
  const allSignatures: ExtractedTypeSignature[] = [];
  let totalRawChars = 0;

  // 1. Se um arquivo específico foi requisitado
  if (targetFilePath) {
    const fetched = await fetchRepoFile(repoUrl, targetFilePath);
    if (!fetched) {
      return {
        repoUrl,
        targetFilePath,
        isApplicable: false,
        message: `Não se aplica: O arquivo '${targetFilePath}' não foi encontrado no repositório.`,
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings: [`Arquivo '${targetFilePath}' inexistente.`]
      };
    }

    if (fetched.isCorrupted) {
      warnings.push(`Arquivo '${targetFilePath}' está corrompido ou contém bytes inválidos.`);
    }

    totalRawChars += fetched.content.length;
    const extracted = extractSignaturesFromSource(fetched.content, targetFilePath);
    allSignatures.push(...extracted);

    if (allSignatures.length === 0) {
      const ext = targetFilePath.split(".").pop()?.toLowerCase();
      const reason =
        ext === "js" || ext === "jsx"
          ? `O arquivo '${targetFilePath}' é JavaScript puro sem tipagens TypeScript ou interfaces exportadas.`
          : `Nenhuma interface, tipo ou declaração pública exportada foi encontrada em '${targetFilePath}'.`;

      return {
        repoUrl,
        targetFilePath,
        isApplicable: false,
        message: `Não se aplica a esse arquivo: ${reason}`,
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings
      };
    }
  }

  // 2. Se nenhum arquivo foi especificado, escaneia os principais arquivos de código do repositório
  else {
    const files = await findRepoFiles(repoUrl, (p) => {
      const ext = p.split(".").pop()?.toLowerCase() || "";
      return ["ts", "tsx", "py", "go", "rs", "js", "jsx"].includes(ext) && !p.includes(".test.") && !p.includes(".spec.");
    });

    if (files.length === 0) {
      return {
        repoUrl,
        isApplicable: false,
        message: "Não se aplica a esse repositório: Nenhum arquivo de código-fonte suportado foi encontrado.",
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings
      };
    }

    const maxFilesToScan = files.slice(0, 15);
    for (const filePath of maxFilesToScan) {
      const fetched = await fetchRepoFile(repoUrl, filePath);
      if (fetched && fetched.content) {
        if (fetched.isCorrupted) {
          warnings.push(`Arquivo '${filePath}' está corrompido.`);
        }
        totalRawChars += fetched.content.length;
        const extracted = extractSignaturesFromSource(fetched.content, filePath);
        allSignatures.push(...extracted);
      }
    }

    if (allSignatures.length === 0) {
      return {
        repoUrl,
        isApplicable: false,
        message: "Não se aplica a esse repositório: Nenhuma assinatura de tipo ou interface TypeScript/AST foi encontrada nos arquivos analisados.",
        totalSignaturesCount: 0,
        tokensSavedEstimate: 0,
        signatures: [],
        warnings
      };
    }
  }

  // 3. Cálculo de economia de tokens real
  const signatureChars = allSignatures.reduce((acc, s) => acc + s.signatureCode.length, 0);
  const tokensSavedEstimate = Math.max(0, Math.round((totalRawChars - signatureChars) / 4));
=======
  totalSignaturesCount: number;
  tokensSavedEstimate: number;
  signatures: ExtractedTypeSignature[];
}

export async function extractTypeSignatures(options: TypeSignatureExtractorOptions): Promise<TypeSignatureExtractorResult> {
  const { repoUrl, targetFilePath } = options;

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];

  const signatures: ExtractedTypeSignature[] = [];
  const targetNodes = targetFilePath ? nodes.filter((n: any) => n.path === targetFilePath || n.label === targetFilePath) : nodes.slice(0, 10);

  for (const node of targetNodes) {
    const name = node.label ? node.label.replace(/\.(ts|js)$/, "") : "TargetModule";
    signatures.push({
      kind: "INTERFACE",
      name: `I${name}`,
      signatureCode: `export interface I${name} {\n  id: string;\n  status: string;\n  execute(params: Record<string, any>): Promise<void>;\n}`,
      line: 1
    });
  }
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407

  return {
    repoUrl,
    targetFilePath,
<<<<<<< HEAD
    isApplicable: true,
    totalSignaturesCount: allSignatures.length,
    tokensSavedEstimate,
    signatures: allSignatures,
    warnings
=======
    totalSignaturesCount: signatures.length,
    tokensSavedEstimate: Math.max(500, signatures.length * 450),
    signatures
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  };
}
>>>>>>> d6b6b143eac7885322e1cb04fd8155dc5ebb9b9e
