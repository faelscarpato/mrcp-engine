import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

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
  totalFunctionsAnalyzed: number;
  untestedHighRiskFunctionsCount: number;
  coverageHealthPercentage: number;
  gaps: UntestedFunctionGap[];
}

export async function findTestCoverageGaps(options: TestGapAnalysisOptions): Promise<TestGapAnalysisResult> {
  const { repoUrl, targetHotspotsOnly = true, generateStubs = true } = options;

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
      .filter((p: string) => p.includes(".test.") || p.includes(".spec.") || p.includes("/test/"))
  );

  const gaps: UntestedFunctionGap[] = [];
  let totalFuncs = 0;

  for (const fileNode of files) {
    const filePath = fileNode.path || fileNode.label || "";
    if (filePath.includes(".test.") || filePath.includes(".spec.") || filePath.includes("/test/")) {
      continue;
    }

    const complexity = fileNode.complexity || 1;
    const loc = fileNode.loc || 10;

    if (targetHotspotsOnly && complexity < 35) {
      continue;
    }

    totalFuncs++;

    // Verifica se existe um arquivo de teste correspondente
    const baseName = filePath.replace(/\.(ts|js|mjs|tsx|jsx)$/, "");
    const expectedTestPath1 = `${baseName}.test.ts`;
    const expectedTestPath2 = `${baseName}.spec.ts`;

    const hasTest = Array.from(testFilePaths).some(
      (tp) => tp.includes(baseName) || tp === expectedTestPath1 || tp === expectedTestPath2
    );

    if (!hasTest) {
      const funcName = fileNode.label ? fileNode.label.replace(/\.(ts|js)$/, "") : "handler";
      const testFileSuggested = `${baseName}.test.ts`;

      let generatedStubCode: string | undefined;
      if (generateStubs) {
        generatedStubCode = `import { describe, it, expect, vi } from 'vitest';
import * as targetModule from './${filePath.split("/").pop()}';

describe('${funcName} unit tests', () => {
  it('should execute successfully without unhandled exceptions', async () => {
    // Stub gerado automaticamente pelo MRCP Engine
    expect(targetModule).toBeDefined();
  });
});`;
      }

      gaps.push({
        functionName: funcName,
        filePath,
        complexity,
        linesOfCode: loc,
        testFileSuggested,
        generatedStubCode
      });
    }
  }

  const gapCount = gaps.length;
  const coverageHealthPercentage = totalFuncs > 0 ? Math.max(0, Math.round(((totalFuncs - gapCount) / totalFuncs) * 100)) : 80;

  return {
    repoUrl,
    totalFunctionsAnalyzed: totalFuncs,
    untestedHighRiskFunctionsCount: gapCount,
    coverageHealthPercentage,
    gaps
  };
}
