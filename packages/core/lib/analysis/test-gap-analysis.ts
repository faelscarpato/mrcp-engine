<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 0a10f0543a8d313cd48c6d2ae1e9fdefdee2a770
import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";
import { fetchRepoFile } from "./repo-fetcher.js";

export interface TestGapAnalysisOptions {
  repoUrl: string;
  targetHotspotsOnly?: boolean;
  generateStubs?: boolean;
}

export interface UntestedFunctionGap {
  functionName: string;
  filePath: string;
  complexity: number;
  linesOfCode: number;
  testFileSuggested: string;
  generatedStubCode?: string;
}

export interface TestGapAnalysisResult {
  repoUrl: string;
  isApplicable: boolean;
  message?: string;
  totalFunctionsAnalyzed: number;
  untestedHighRiskFunctionsCount: number;
  coverageHealthPercentage: number;
  gaps: UntestedFunctionGap[];
  warnings: string[];
}

export async function findTestCoverageGaps(options: TestGapAnalysisOptions): Promise<TestGapAnalysisResult> {
  const { repoUrl, targetHotspotsOnly = false, generateStubs = true } = options;
  const warnings: string[] = [];

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];
  const files: any[] = nodes.filter((n: any) => {
    if (n.kind !== "file") return false;
    const p = (n.path || n.label || "").toLowerCase();
    const ext = p.split(".").pop() || "";
    return ["ts", "tsx", "js", "jsx", "mjs", "py", "go", "rs", "java", "cpp", "c"].includes(ext) &&
      !p.endsWith(".d.ts") &&
      !p.includes("node_modules") &&
      !p.includes(".git");
  });

  const testFilePaths = new Set(
    files
      .map((f: any) => f.path || f.label || "")
      .filter((p: string) => p.includes(".test.") || p.includes(".spec.") || p.includes("/test/") || p.includes("/tests/"))
  );

  const gaps: UntestedFunctionGap[] = [];
  let totalFuncs = 0;

  for (const fileNode of files) {
    const filePath = fileNode.path || fileNode.label || "";
    if (
      filePath.includes(".test.") ||
      filePath.includes(".spec.") ||
      filePath.includes("/test/") ||
      filePath.includes("/tests/")
    ) {
      continue;
    }

    const complexity = fileNode.complexity || 1;
    const loc = fileNode.loc || 10;

    // Se targetHotspotsOnly estiver ativo, filtra complexidade baixa
    if (targetHotspotsOnly && complexity < 30) {
      continue;
    }

    totalFuncs++;

    // Verifica se existe arquivo de teste correspondente
    const baseName = filePath.replace(/\.(ts|js|mjs|tsx|jsx|py|go|rs)$/, "");
    const ext = filePath.split(".").pop() || "ts";
    const testExt = ext === "py" ? ".py" : ext === "go" ? "_test.go" : ".test.ts";
    const expectedTestPath = `${baseName}${testExt}`;

    const hasTest = Array.from(testFilePaths).some(
      (tp) => tp.includes(baseName) || tp.endsWith(expectedTestPath)
    );

    if (!hasTest) {
      const moduleName = fileNode.label ? fileNode.label.replace(/\.[^.]+$/, "") : "handler";
      const testFileSuggested = `${baseName}.test.ts`;

      let generatedStubCode: string | undefined;
      if (generateStubs) {
        generatedStubCode = `import { describe, it, expect, vi } from 'vitest';
import * as ${moduleName}Module from './${filePath.split("/").pop()}';

describe('${moduleName} unit tests', () => {
  it('should be defined and export expected symbols', () => {
    expect(${moduleName}Module).toBeDefined();
  });
});`;
      }

      gaps.push({
        functionName: moduleName,
        filePath,
        complexity,
        linesOfCode: loc,
        testFileSuggested,
        generatedStubCode
      });
    }
  }

  if (totalFuncs === 0) {
    return {
      repoUrl,
      isApplicable: false,
      message: "Não se aplica a esse repositório: Nenhuma função ou módulo de código foi identificado para verificação de testes.",
      totalFunctionsAnalyzed: 0,
      untestedHighRiskFunctionsCount: 0,
      coverageHealthPercentage: 100,
      gaps: [],
      warnings
    };
  }

  const gapCount = gaps.length;
  const coverageHealthPercentage = Math.max(0, Math.round(((totalFuncs - gapCount) / totalFuncs) * 100));

  return {
    repoUrl,
    isApplicable: true,
    totalFunctionsAnalyzed: totalFuncs,
    untestedHighRiskFunctionsCount: gapCount,
    coverageHealthPercentage,
    gaps,
    warnings
  };
}
<<<<<<< HEAD
=======
=======
import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";
<<<<<<< HEAD
import { fetchRepoFile } from "./repo-fetcher.js";
=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407

export interface TestGapAnalysisOptions {
  repoUrl: string;
  targetHotspotsOnly?: boolean;
  generateStubs?: boolean;
}

export interface UntestedFunctionGap {
  functionName: string;
  filePath: string;
  complexity: number;
  linesOfCode: number;
  testFileSuggested: string;
  generatedStubCode?: string;
}

export interface TestGapAnalysisResult {
  repoUrl: string;
<<<<<<< HEAD
  isApplicable: boolean;
  message?: string;
=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  totalFunctionsAnalyzed: number;
  untestedHighRiskFunctionsCount: number;
  coverageHealthPercentage: number;
  gaps: UntestedFunctionGap[];
<<<<<<< HEAD
  warnings: string[];
}

export async function findTestCoverageGaps(options: TestGapAnalysisOptions): Promise<TestGapAnalysisResult> {
  const { repoUrl, targetHotspotsOnly = false, generateStubs = true } = options;
  const warnings: string[] = [];
=======
}

export async function findTestCoverageGaps(options: TestGapAnalysisOptions): Promise<TestGapAnalysisResult> {
  const { repoUrl, targetHotspotsOnly = true, generateStubs = true } = options;
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];
  const files: any[] = nodes.filter((n: any) => n.kind === "file" || n.kind === "config");

  const testFilePaths = new Set(
    files
      .map((f: any) => f.path || f.label || "")
<<<<<<< HEAD
      .filter((p: string) => p.includes(".test.") || p.includes(".spec.") || p.includes("/test/") || p.includes("/tests/"))
=======
      .filter((p: string) => p.includes(".test.") || p.includes(".spec.") || p.includes("/test/"))
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  );

  const gaps: UntestedFunctionGap[] = [];
  let totalFuncs = 0;

  for (const fileNode of files) {
    const filePath = fileNode.path || fileNode.label || "";
<<<<<<< HEAD
    if (
      filePath.includes(".test.") ||
      filePath.includes(".spec.") ||
      filePath.includes("/test/") ||
      filePath.includes("/tests/")
    ) {
=======
    if (filePath.includes(".test.") || filePath.includes(".spec.") || filePath.includes("/test/")) {
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
      continue;
    }

    const complexity = fileNode.complexity || 1;
    const loc = fileNode.loc || 10;

<<<<<<< HEAD
    // Se targetHotspotsOnly estiver ativo, filtra complexidade baixa
    if (targetHotspotsOnly && complexity < 30) {
=======
    if (targetHotspotsOnly && complexity < 35) {
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
      continue;
    }

    totalFuncs++;

<<<<<<< HEAD
    // Verifica se existe arquivo de teste correspondente
    const baseName = filePath.replace(/\.(ts|js|mjs|tsx|jsx|py|go|rs)$/, "");
    const ext = filePath.split(".").pop() || "ts";
    const testExt = ext === "py" ? ".py" : ext === "go" ? "_test.go" : ".test.ts";
    const expectedTestPath = `${baseName}${testExt}`;

    const hasTest = Array.from(testFilePaths).some(
      (tp) => tp.includes(baseName) || tp.endsWith(expectedTestPath)
    );

    if (!hasTest) {
      const moduleName = fileNode.label ? fileNode.label.replace(/\.[^.]+$/, "") : "handler";
=======
    // Verifica se existe um arquivo de teste correspondente
    const baseName = filePath.replace(/\.(ts|js|mjs|tsx|jsx)$/, "");
    const expectedTestPath1 = `${baseName}.test.ts`;
    const expectedTestPath2 = `${baseName}.spec.ts`;

    const hasTest = Array.from(testFilePaths).some(
      (tp) => tp.includes(baseName) || tp === expectedTestPath1 || tp === expectedTestPath2
    );

    if (!hasTest) {
      const funcName = fileNode.label ? fileNode.label.replace(/\.(ts|js)$/, "") : "handler";
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
      const testFileSuggested = `${baseName}.test.ts`;

      let generatedStubCode: string | undefined;
      if (generateStubs) {
        generatedStubCode = `import { describe, it, expect, vi } from 'vitest';
<<<<<<< HEAD
import * as ${moduleName}Module from './${filePath.split("/").pop()}';

describe('${moduleName} unit tests', () => {
  it('should be defined and export expected symbols', () => {
    expect(${moduleName}Module).toBeDefined();
=======
import * as targetModule from './${filePath.split("/").pop()}';

describe('${funcName} unit tests', () => {
  it('should execute successfully without unhandled exceptions', async () => {
    // Stub gerado automaticamente pelo MRCP Engine
    expect(targetModule).toBeDefined();
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  });
});`;
      }

      gaps.push({
<<<<<<< HEAD
        functionName: moduleName,
=======
        functionName: funcName,
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
        filePath,
        complexity,
        linesOfCode: loc,
        testFileSuggested,
        generatedStubCode
      });
    }
  }

<<<<<<< HEAD
  if (totalFuncs === 0) {
    return {
      repoUrl,
      isApplicable: false,
      message: "Não se aplica a esse repositório: Nenhuma função ou módulo de código foi identificado para verificação de testes.",
      totalFunctionsAnalyzed: 0,
      untestedHighRiskFunctionsCount: 0,
      coverageHealthPercentage: 100,
      gaps: [],
      warnings
    };
  }

  const gapCount = gaps.length;
  const coverageHealthPercentage = Math.max(0, Math.round(((totalFuncs - gapCount) / totalFuncs) * 100));

  return {
    repoUrl,
    isApplicable: true,
    totalFunctionsAnalyzed: totalFuncs,
    untestedHighRiskFunctionsCount: gapCount,
    coverageHealthPercentage,
    gaps,
    warnings
=======
  const gapCount = gaps.length;
  const coverageHealthPercentage = totalFuncs > 0 ? Math.max(0, Math.round(((totalFuncs - gapCount) / totalFuncs) * 100)) : 80;

  return {
    repoUrl,
    totalFunctionsAnalyzed: totalFuncs,
    untestedHighRiskFunctionsCount: gapCount,
    coverageHealthPercentage,
    gaps
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  };
}
>>>>>>> d6b6b143eac7885322e1cb04fd8155dc5ebb9b9e
>>>>>>> 0a10f0543a8d313cd48c6d2ae1e9fdefdee2a770
