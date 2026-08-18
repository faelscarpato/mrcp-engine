import { findRepoFiles, fetchRepoFile } from "./repo-fetcher.js";

export interface EnvVariableUsage {
  name: string;
  files: string[];
  occurrencesCount: number;
  inferredType: "string" | "number" | "boolean" | "url" | "secret";
  isRequired: boolean;
  isExposedToClient: boolean;
  hasDefaultInCode: boolean;
}

export interface EnvValidatorOptions {
  repoUrl: string;
}

export interface EnvValidatorResult {
  repoUrl: string;
  totalVariablesDetected: number;
  variables: EnvVariableUsage[];
  exampleFilesFound: string[];
  undocumentedVariables: string[];
  unusedExampleVariables: string[];
  securityWarnings: string[];
  generatedDotEnvExample: string;
  zodSchemaSnippet: string;
  isApplicable: boolean;
  message?: string;
}

export async function validateEnvironmentContract(options: EnvValidatorOptions): Promise<EnvValidatorResult> {
  const { repoUrl } = options;

  // Search for source files and env example files
  const sourceFiles = await findRepoFiles(repoUrl, (filePath) => {
    const p = filePath.toLowerCase();
    return (
      (p.endsWith(".ts") ||
        p.endsWith(".tsx") ||
        p.endsWith(".js") ||
        p.endsWith(".jsx") ||
        p.endsWith(".mjs") ||
        p.endsWith(".py") ||
        p.endsWith(".go") ||
        p.endsWith(".rs") ||
        p.includes(".env") ||
        p.endsWith("docker-compose.yml") ||
        p.endsWith("docker-compose.yaml")) &&
      !p.includes("node_modules") &&
      !p.includes(".git") &&
      !p.includes("dist/")
    );
  });

  const varMap = new Map<string, { files: Set<string>; count: number; hasDefault: boolean }>();
  const exampleVars = new Set<string>();
  const exampleFilesFound: string[] = [];

  for (const filePath of sourceFiles) {
    const file = await fetchRepoFile(repoUrl, filePath);
    if (!file || !file.content) continue;

    const content = file.content;
    const lowerPath = filePath.toLowerCase();

    // Check if it's an .env.example / template file
    if (
      lowerPath.endsWith(".env.example") ||
      lowerPath.endsWith(".env.template") ||
      lowerPath.endsWith(".env.sample") ||
      lowerPath.endsWith(".env.dist")
    ) {
      exampleFilesFound.push(filePath);
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const varName = trimmed.split("=")[0].trim();
          if (varName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            exampleVars.add(varName);
          }
        }
      }
      continue;
    }

    // JS/TS: process.env.VAR_NAME, process.env['VAR_NAME'], import.meta.env.VITE_VAR
    const jsEnvRegex = /(?:process\.env(?:\?\.|\.)([A-Z0-9_]+)|process\.env\[["']([A-Z0-9_]+)["']|import\.meta\.env(?:\?\.|\.)([A-Z0-9_]+))/g;
    let m;
    while ((m = jsEnvRegex.exec(content)) !== null) {
      const varName = m[1] || m[2] || m[3];
      if (varName && isValidEnvName(varName)) {
        recordVarUsage(varMap, varName, filePath, content, m.index);
      }
    }

    // Python: os.environ.get("VAR"), os.environ["VAR"], os.getenv("VAR")
    if (lowerPath.endsWith(".py")) {
      const pyEnvRegex = /(?:os\.environ\.get\s*\(\s*["']([A-Z0-9_]+)["']|os\.environ\s*\[\s*["']([A-Z0-9_]+)["']|os\.getenv\s*\(\s*["']([A-Z0-9_]+)["'])/g;
      let pym;
      while ((pym = pyEnvRegex.exec(content)) !== null) {
        const varName = pym[1] || pym[2] || pym[3];
        if (varName && isValidEnvName(varName)) {
          recordVarUsage(varMap, varName, filePath, content, pym.index);
        }
      }
    }

    // Go: os.Getenv("VAR")
    if (lowerPath.endsWith(".go")) {
      const goEnvRegex = /os\.Getenv\s*\(\s*["']([A-Z0-9_]+)["']/g;
      let gom;
      while ((gom = goEnvRegex.exec(content)) !== null) {
        const varName = gom[1];
        if (varName && isValidEnvName(varName)) {
          recordVarUsage(varMap, varName, filePath, content, gom.index);
        }
      }
    }
  }

  const variables: EnvVariableUsage[] = [];
  const securityWarnings: string[] = [];

  for (const [name, info] of varMap.entries()) {
    const isExposed = name.startsWith("NEXT_PUBLIC_") || name.startsWith("VITE_") || name.startsWith("REACT_APP_") || name.startsWith("PUBLIC_");
    const isSecretName = /SECRET|KEY|PASSWORD|TOKEN|AUTH|CREDENTIAL|PRIVATE/i.test(name);

    let inferredType: "string" | "number" | "boolean" | "url" | "secret" = "string";
    if (isSecretName) inferredType = "secret";
    else if (/PORT|TIMEOUT|MAX|MIN|LIMIT|COUNT|RETRIES/i.test(name)) inferredType = "number";
    else if (/ENABLE|DISABLE|IS_|HAS_|FLAG|DEBUG|PROD/i.test(name)) inferredType = "boolean";
    else if (/URL|URI|ENDPOINT|HOST/i.test(name)) inferredType = "url";

    if (isExposed && isSecretName) {
      securityWarnings.push(`⚠️ Risco de vazamento de credencial: '${name}' está exposta no bundle cliente (prefixo público) contendo termo confidencial.`);
    }

    variables.push({
      name,
      files: Array.from(info.files),
      occurrencesCount: info.count,
      inferredType,
      isRequired: !info.hasDefault,
      isExposedToClient: isExposed,
      hasDefaultInCode: info.hasDefault
    });
  }

  variables.sort((a, b) => b.occurrencesCount - a.occurrencesCount);

  const foundVarNames = new Set(variables.map((v) => v.name));
  const undocumentedVariables = variables.filter((v) => !exampleVars.has(v.name)).map((v) => v.name);
  const unusedExampleVariables = Array.from(exampleVars).filter((name) => !foundVarNames.has(name));

  // Generate .env.example
  const dotEnvLines: string[] = [
    `# ==========================================================`,
    `# 🔐 Generated .env.example by MRCP Engine v2.3.0`,
    `# Target Repo: ${repoUrl}`,
    `# ==========================================================`,
    ``
  ];

  for (const v of variables) {
    let exampleVal = `your_${v.name.toLowerCase()}`;
    if (v.inferredType === "number") exampleVal = "3000";
    else if (v.inferredType === "boolean") exampleVal = "true";
    else if (v.inferredType === "url") exampleVal = "https://api.example.com";
    else if (v.inferredType === "secret") exampleVal = "super_secret_token_change_in_prod";

    dotEnvLines.push(`# [Type: ${v.inferredType}] ${v.isRequired ? "Required" : "Optional"} | Usages: ${v.occurrencesCount} files: ${v.files.slice(0, 2).join(", ")}`);
    dotEnvLines.push(`${v.name}=${exampleVal}`);
    dotEnvLines.push(``);
  }

  // Generate Zod Schema
  const zodLines: string[] = [
    `import { z } from "zod";`,
    ``,
    `export const envSchema = z.object({`,
  ];

  for (const v of variables) {
    let zodType = "z.string()";
    if (v.inferredType === "number") zodType = "z.coerce.number()";
    else if (v.inferredType === "boolean") zodType = "z.coerce.boolean()";
    else if (v.inferredType === "url") zodType = "z.string().url()";
    else if (v.inferredType === "secret") zodType = "z.string().min(1)";

    if (!v.isRequired) {
      zodType += ".optional()";
    }

    zodLines.push(`  /** Inferred from ${v.files.length} files (${v.files.slice(0, 2).join(", ")}) */`);
    zodLines.push(`  ${v.name}: ${zodType},`);
  }

  zodLines.push(`});`, ``, `export type Env = z.infer<typeof envSchema>;`, ``, `export const env = envSchema.parse(process.env);`);

  const isApplicable = variables.length > 0 || exampleFilesFound.length > 0;

  return {
    repoUrl,
    totalVariablesDetected: variables.length,
    variables,
    exampleFilesFound,
    undocumentedVariables,
    unusedExampleVariables,
    securityWarnings,
    generatedDotEnvExample: dotEnvLines.join("\n"),
    zodSchemaSnippet: zodLines.join("\n"),
    isApplicable,
    message: isApplicable
      ? `Detectadas ${variables.length} variáveis de ambiente no código. ${undocumentedVariables.length} não documentadas no .env.example. Schema Zod e template gerados.`
      : "Nenhuma variável de ambiente encontrada no código analisado."
  };
}

function isValidEnvName(name: string): boolean {
  if (name.length < 2 || name.length > 60) return false;
  // Ignore standard node env values like NODE_ENV if alone or common keywords
  return /^[A-Z][A-Z0-9_]+$/.test(name);
}

function recordVarUsage(
  varMap: Map<string, { files: Set<string>; count: number; hasDefault: boolean }>,
  varName: string,
  filePath: string,
  content: string,
  matchIndex: number
) {
  if (!varMap.has(varName)) {
    varMap.set(varName, { files: new Set(), count: 0, hasDefault: false });
  }
  const entry = varMap.get(varName)!;
  entry.files.add(filePath);
  entry.count++;

  const surrounding = content.slice(matchIndex, matchIndex + 60);
  if (surrounding.includes("||") || surrounding.includes("??") || surrounding.includes("default") || surrounding.includes("?")) {
    entry.hasDefault = true;
  }
}
