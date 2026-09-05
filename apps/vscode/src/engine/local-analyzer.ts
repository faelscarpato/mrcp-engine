import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  MrcpSuiteResult,
  MrcpFileAnalysis,
  MrcpSecurityIssue,
  MrcpEnvIssue,
  MrcpTestGap,
  MrcpDeadCodeItem,
  MrcpApiRoute,
  MrcpDocItem,
  MrcpGodModuleItem,
  MrcpProvenanceMetadata,
} from "./types";
import {
  CODE_EXTENSIONS,
  DOC_EXTENSIONS,
  SECRET_RULES,
  getLanguageName,
  extractTypedAstSymbols,
} from "./ast-extractors";
import { extractApiRoutes } from "./api-scanner";
import {
  detectDuplicateModules,
  resolveImportPaths,
  findCycles,
} from "./metrics";
import {
  scanDir,
  processDocumentFiles,
  detectDeadCode,
  detectTestGaps,
  IGNORED_DIRS,
} from "./analyzer-helpers";
import { processSingleCodeFile } from "./file-processor";

export async function analyzeWorkspaceLocally(
  workspaceRoot: string,
  maxFiles = 2000,
  onProgress?: (percent: number, message: string) => void,
): Promise<MrcpSuiteResult> {
  const startTime = Date.now();
  onProgress?.(5, "Escaneando estrutura do workspace...");

  const allFilePaths: string[] = [];
  await scanDir(workspaceRoot, workspaceRoot, allFilePaths, maxFiles);

  const codeFiles = allFilePaths.filter((f) =>
    CODE_EXTENSIONS.has(path.extname(f).toLowerCase()),
  );
  const docFiles = allFilePaths.filter((f) =>
    DOC_EXTENSIONS.has(path.extname(f).toLowerCase()),
  );

  // 1. Read defined .env variables
  const definedEnvVars = new Set<string>();
  const envFileCandidates = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.example",
  ];
  for (const envFile of envFileCandidates) {
    const envPath = path.join(workspaceRoot, envFile);
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split("\n")) {
          const match = line.match(/^\s*([A-Z0-9_]+)\s*=/i);
          if (match && match[1]) {
            definedEnvVars.add(match[1]);
          }
        }
      } catch {
        // .env pode não ser legível; segue para o próximo candidato
      }
    }
  }

  // Pre-load all test files and all workspace code for cross-referencing
  const testFileMap = new Set<string>();
  const allTestFilesContent: string[] = [];
  const fileContentsMap = new Map<string, string>();

  for (const f of allFilePaths) {
    const base = path.basename(f).toLowerCase();
    if (
      base.includes(".test.") ||
      base.includes(".spec.") ||
      base.startsWith("test_") ||
      f.includes("/tests/") ||
      f.includes("/__tests__/")
    ) {
      testFileMap.add(base);
      testFileMap.add(base.replace(/(\.test|\.spec)/, ""));
      try {
        allTestFilesContent.push(fs.readFileSync(f, "utf8"));
      } catch {
        // Arquivo de teste pode ter sido removido ou não ser legível
      }
    }
    if (CODE_EXTENSIONS.has(path.extname(f).toLowerCase())) {
      try {
        fileContentsMap.set(f, fs.readFileSync(f, "utf8"));
      } catch {
        // Arquivo de código pode ter sido removido ou não ser legível
      }
    }
  }
  const combinedTestContent = allTestFilesContent.join("\n");

  const analyzedFiles: MrcpFileAnalysis[] = [];
  const godModules: MrcpGodModuleItem[] = [];
  const securityIssues: MrcpSecurityIssue[] = [];
  const envIssues: MrcpEnvIssue[] = [];
  const apiRoutes: MrcpApiRoute[] = [];
  const docItems: MrcpDocItem[] = [];
  const importGraph = new Map<string, string[]>();

  const allExportedSymbols = new Map<
    string,
    { name: string; file: string; line: number; kind: string }
  >();
  const allImportedSymbolNames = new Set<string>();

  let totalRawBytes = 0;
  let totalFunctionComplexity = 0;
  let totalFunctionCount = 0;
  let totalFileMI = 0;

  const hasher = crypto.createHash("sha256");

  // Process Code Files
  for (let i = 0; i < codeFiles.length; i++) {
    const filePath = codeFiles[i];
    const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, "/");
    const percent = Math.round(10 + (i / codeFiles.length) * 55);
    onProgress?.(
      percent,
      `Analisando AST de ${path.basename(filePath)} (${i + 1}/${codeFiles.length})...`,
    );

    try {
      const content =
        fileContentsMap.get(filePath) || fs.readFileSync(filePath, "utf8");
      const stat = fs.statSync(filePath);
      totalRawBytes += stat.size;
      hasher.update(content);

      const processed = processSingleCodeFile({
        filePath,
        relPath,
        content,
        statSize: stat.size,
        workspaceRoot,
        allFilePaths,
        definedEnvVars,
        testFileMap,
        combinedTestContent,
        securityIssues,
        envIssues,
        godModules,
        allExportedSymbols,
        allImportedSymbolNames,
        importGraph,
      });

      totalFileMI += processed.fileNormalizedMI;
      totalFunctionComplexity += processed.fnComplexity;
      totalFunctionCount += processed.fnCount;
      analyzedFiles.push(processed.analysis);
    } catch {
      // Falha pontual em um arquivo não deve interromper a análise completa
    }
  }

  // 2. Extract Complete HTTP Routes & Aliases
  onProgress?.(70, "Extraindo contratos HTTP e métodos de despacho...");
  extractApiRoutes(workspaceRoot, codeFiles, apiRoutes);

  // 3. Process Document Files
  onProgress?.(75, "Analisando inteligência documental & DQI...");
  docItems.push(...processDocumentFiles(workspaceRoot, docFiles));

  // 4. Detect Dependency Cycles & Duplications
  onProgress?.(85, "Detectando ciclos e duplicação entre módulos...");
  const dependencyCycles = findCycles(importGraph);
  const duplicateModules = detectDuplicateModules(workspaceRoot);

  // 5. Detect True Dead Code
  const deadCodeItems = detectDeadCode(
    workspaceRoot,
    allExportedSymbols,
    allImportedSymbolNames,
    fileContentsMap,
  );

  // 6. Detect Genuine Test Gaps
  const testGaps = detectTestGaps(analyzedFiles);

  // 7. Compute Final Metrics
  onProgress?.(95, "Consolidando métricas e fingerprint...");
  const totalFiles = analyzedFiles.length;
  const totalSymbols = analyzedFiles.reduce(
    (acc, f) => acc + f.symbols.length,
    0,
  );
  const avgComplexity =
    totalFunctionCount > 0
      ? Math.round((totalFunctionComplexity / totalFunctionCount) * 10) / 10
      : 1.5;

  const maintainabilityIndex =
    totalFiles > 0 ? Math.round(totalFileMI / totalFiles) : 100;

  let healthScore = maintainabilityIndex;
  healthScore -= Math.min(
    20,
    securityIssues.filter(
      (s) => s.severity === "critical" || s.severity === "high",
    ).length * 8,
  );
  healthScore -= Math.min(10, godModules.length * 2);
  healthScore -= Math.min(10, dependencyCycles.length * 4);
  healthScore = Math.max(10, Math.min(100, healthScore));

  let letterGrade: "A" | "B" | "C" | "D" | "F" = "A";
  if (healthScore >= 80) letterGrade = "A";
  else if (healthScore >= 68) letterGrade = "B";
  else if (healthScore >= 50) letterGrade = "C";
  else if (healthScore >= 35) letterGrade = "D";
  else letterGrade = "F";

  const docQualityAvg =
    docItems.length > 0
      ? Math.round(
          docItems.reduce((acc, d) => acc + d.qualityScore, 0) /
            docItems.length,
        )
      : 100;

  const rawTokens = Math.round(totalRawBytes / 3.8);
  const mrcpTokens = Math.round(totalSymbols * 18 + totalFiles * 25);
  const tokenSavingsPercent =
    rawTokens > 0
      ? Math.min(
          98,
          Math.max(
            75,
            Math.round(((rawTokens - mrcpTokens) / rawTokens) * 100),
          ),
        )
      : 95;

  const durationMs = Date.now() - startTime;
  const fingerprint = hasher.digest("hex").substring(0, 16);

  let gitRevision = "local-dev";
  try {
    const headPath = path.join(workspaceRoot, ".git/HEAD");
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, "utf8").trim();
      if (head.startsWith("ref:")) {
        const refPath = path.join(
          workspaceRoot,
          ".git",
          head.substring(4).trim(),
        );
        if (fs.existsSync(refPath)) {
          gitRevision = fs.readFileSync(refPath, "utf8").trim().substring(0, 8);
        }
      }
    }
  } catch {
    // Workspace pode não ser um repositório git completo; mantém "local-dev"
  }

  const provenance: MrcpProvenanceMetadata = {
    generatedAt: new Date().toISOString(),
    analyzerVersion: "2.6.0",
    repositoryRevision: gitRevision,
    source: "local-workspace",
    workspaceFingerprint: fingerprint,
    includedExtensions: Array.from(CODE_EXTENSIONS),
    excludedDirectories: Array.from(IGNORED_DIRS),
    calculationVersion: "2.6.0-sei",
    cache: {
      used: false,
      valid: true,
      reason: null,
    },
  };

  return {
    workspaceRoot,
    timestamp: new Date().toISOString(),
    totalDurationMs: durationMs,
    provenance,
    summary: {
      healthScore,
      letterGrade,
      maintainabilityIndex,
      totalFiles,
      totalLinesOfCode: analyzedFiles.reduce((acc, f) => acc + f.linesCount, 0),
      totalSymbols,
      avgComplexity,
      godModulesCount: godModules.length,
      securityIssuesCount: securityIssues.length,
      missingEnvCount: envIssues.length,
      dependencyCyclesCount: dependencyCycles.length,
      testGapsCount: testGaps.length,
      deadCodeCount: deadCodeItems.length,
      apiRoutesCount: apiRoutes.length,
      documentsCount: docItems.length,
      documentQualityScore: docQualityAvg,
      estimatedTokensWithoutMrcp: rawTokens,
      estimatedTokensWithMrcp: mrcpTokens,
      tokenSavingsPercent,
    },
    godModules,
    duplicateModules,
    files: analyzedFiles,
    securityIssues,
    envIssues,
    dependencyCycles,
    testGaps,
    deadCodeItems,
    apiRoutes,
    documents: docItems,
  };
}
