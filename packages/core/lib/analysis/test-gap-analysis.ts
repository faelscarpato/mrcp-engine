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
  // `null` quando o grafo não traziu a métrica: inventar 1/10 sugeriria risco
  // e volume de código que não foram medidos.
  complexity: number | null;
  linesOfCode: number | null;
  testFileSuggested: string;
  generatedStubCode?: string;
}

export interface TestGapAnalysisResult {
  repoUrl: string;
  isApplicable: boolean;
  message?: string;
  totalFunctionsAnalyzed: number | null;
  untestedHighRiskFunctionsCount: number | null;
  // `null` = cobertura não mensurável (nada analisado). 100 afirmaria
  // "cobertura total" sem nenhuma função ter sido verificada.
  coverageHealthPercentage: number | null;
  gaps: UntestedFunctionGap[];
  warnings: string[];
}

export async function findTestCoverageGaps(
  options: TestGapAnalysisOptions,
): Promise<TestGapAnalysisResult> {
  const { repoUrl, targetHotspotsOnly = false, generateStubs = true } = options;
  const warnings: string[] = [];

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];
  const files: any[] = nodes.filter((n: any) => {
    if (n.kind !== "file") return false;
    const p = (n.path || n.label || "").toLowerCase();
    const ext = p.split(".").pop() || "";
    return (
      [
        "ts",
        "tsx",
        "js",
        "jsx",
        "mjs",
        "py",
        "go",
        "rs",
        "java",
        "cpp",
        "c",
      ].includes(ext) &&
      !p.endsWith(".d.ts") &&
      !p.includes("node_modules") &&
      !p.includes(".git")
    );
  });

  const testFilePaths = new Set(
    files
      .map((f: any) => f.path || f.label || "")
      .filter(
        (p: string) =>
          p.includes(".test.") ||
          p.includes(".spec.") ||
          p.includes("/test/") ||
          p.includes("/tests/"),
      ),
  );

  const gaps: UntestedFunctionGap[] = [];
  const filesWithoutMetrics: string[] = [];
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

    // Métricas reais quando existem no grafo; ausentes viram null em vez dos
    // placeholders 1/10, que descreviam um risco que ninguém mediu.
    const rawComplexity = fileNode.complexity;
    const rawLoc = fileNode.loc;
    const complexity = typeof rawComplexity === "number" ? rawComplexity : null;
    const loc = typeof rawLoc === "number" ? rawLoc : null;
    if (complexity === null || loc === null) {
      filesWithoutMetrics.push(filePath || fileNode.label || "desconhecido");
    }

    // Se targetHotspotsOnly estiver ativo, filtra complexidade baixa
    if (targetHotspotsOnly && (complexity ?? 0) < 30) {
      continue;
    }

    totalFuncs++;

    // Verifica se existe arquivo de teste correspondente
    const baseName = filePath.replace(/\.(ts|js|mjs|tsx|jsx|py|go|rs)$/, "");
    const ext = filePath.split(".").pop() || "ts";
    const testExt =
      ext === "py" ? ".py" : ext === "go" ? "_test.go" : ".test.ts";
    const expectedTestPath = `${baseName}${testExt}`;

    const hasTest = Array.from(testFilePaths).some(
      (tp) => tp.includes(baseName) || tp.endsWith(expectedTestPath),
    );

    if (!hasTest) {
      const moduleName = fileNode.label
        ? fileNode.label.replace(/\.[^.]+$/, "")
        : "handler";
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
        generatedStubCode,
      });
    }
  }

  if (totalFuncs === 0) {
    // 100% de saúde de cobertura aqui seria uma afirmação falsa: nada foi
    // analisado. A métrica fica ausente e a razão é explícita.
    warnings.push(
      "Nenhuma função ou módulo de código foi analisado: saúde de cobertura não mensurável (percentual ausente, não 0% nem 100%).",
    );
    return {
      repoUrl,
      isApplicable: false,
      message:
        "Não se aplica a esse repositório: Nenhuma função ou módulo de código foi identificado para verificação de testes. A saúde de cobertura não pode ser calculada — percentual ausente (null), não 0% nem 100%.",
      totalFunctionsAnalyzed: null,
      untestedHighRiskFunctionsCount: null,
      coverageHealthPercentage: null,
      gaps: [],
      warnings,
    };
  }

  if (filesWithoutMetrics.length > 0) {
    const sample = filesWithoutMetrics.slice(0, 5).join(", ");
    warnings.push(
      `${filesWithoutMetrics.length} arquivo(s) sem complexidade/LOC no grafo: complexidade e linhas ficaram ausentes (null) em vez de assume 1/10 (amostra: ${sample}).`,
    );
  }

  const gapCount = gaps.length;
  const coverageHealthPercentage = Math.max(
    0,
    Math.round(((totalFuncs - gapCount) / totalFuncs) * 100),
  );

  return {
    repoUrl,
    isApplicable: true,
    totalFunctionsAnalyzed: totalFuncs,
    untestedHighRiskFunctionsCount: gapCount,
    coverageHealthPercentage,
    gaps,
    warnings,
  };
}
