import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

export interface CodeHealthOptions {
  repoUrl: string;
}

export interface RefactoringHotspot {
  file: string;
  cyclomaticComplexity: number;
  linesOfCode: number;
  couplingDegree: number;
  cognitiveLoad: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  estimatedEffortHours: number;
  primaryIssue: string;
  recommendedAction: string;
}

export interface CodeHealthResult {
  repoUrl: string;
  maintainabilityIndex: number; // 0 - 100
  maintainabilityRating: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR" | "CRITICAL";
  technicalDebtScore: number; // 0 - 100 (lower is better)
  letterGrade: "A" | "B" | "C" | "D" | "F";
  summary: {
    totalFiles: number;
    totalLinesOfCode: number;
    totalFunctions: number;
    averageComplexityPerFile: number;
    testToCodeRatio: number;
    godModulesCount: number;
  };
  cognitiveLoadDistribution: {
    low: number; // %
    moderate: number; // %
    high: number; // %
    extreme: number; // %
  };
  topRefactoringPriorities: RefactoringHotspot[];
  isApplicable: boolean;
  message?: string;
}

export async function calculateCodeHealth(options: CodeHealthOptions): Promise<CodeHealthResult> {
  const { repoUrl } = options;

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];
  const edges: any[] = graphData?.analysis?.edges || graphData?.edges || [];

  if (nodes.length === 0) {
    return {
      repoUrl,
      maintainabilityIndex: 100,
      maintainabilityRating: "EXCELLENT",
      technicalDebtScore: 0,
      letterGrade: "A",
      summary: {
        totalFiles: 0,
        totalLinesOfCode: 0,
        totalFunctions: 0,
        averageComplexityPerFile: 0,
        testToCodeRatio: 0,
        godModulesCount: 0
      },
      cognitiveLoadDistribution: { low: 100, moderate: 0, high: 0, extreme: 0 },
      topRefactoringPriorities: [],
      isApplicable: false,
      message: "Nenhum nó de código foi encontrado para avaliar a saúde do repositório."
    };
  }

  const fileNodes = nodes.filter((n) => n.kind === "file");
  const testNodes = fileNodes.filter((n) => {
    const p = (n.path || n.label || "").toLowerCase();
    return p.includes(".test.") || p.includes(".spec.") || p.includes("__tests__") || p.includes("tests/");
  });

  let totalLoc = 0;
  let totalComplexity = 0;
  let godModulesCount = 0;
  let lowCount = 0;
  let modCount = 0;
  let highCount = 0;
  let extremeCount = 0;

  const hotspots: RefactoringHotspot[] = [];

  for (const f of fileNodes) {
    const loc = f.metrics?.loc || f.loc || 50;
    const complexity = f.metrics?.cyclomaticComplexity || f.metrics?.complexity || (f.complexity ? f.complexity : 5);
    const coupling = f.metrics?.fanIn || f.fanIn || 1;

    totalLoc += loc;
    totalComplexity += complexity;

    let cognitiveLoad: "LOW" | "MODERATE" | "HIGH" | "EXTREME" = "LOW";
    if (complexity > 50 || loc > 800) {
      cognitiveLoad = "EXTREME";
      extremeCount++;
    } else if (complexity > 25 || loc > 400) {
      cognitiveLoad = "HIGH";
      highCount++;
    } else if (complexity > 10 || loc > 150) {
      cognitiveLoad = "MODERATE";
      modCount++;
    } else {
      lowCount++;
    }

    if (f.isGodModule || (complexity > 40 && loc > 500)) {
      godModulesCount++;
    }

    if (complexity >= 15 || loc >= 250) {
      const hours = Math.round((complexity * 0.15 + (loc / 100) * 0.5) * 10) / 10;
      let issue = "Alta densidade de complexidade ciclomática";
      let action = "Decompor funções longas e extrair módulos auxiliares";

      if (loc > 600) {
        issue = "Arquivo monolítico com excesso de responsabilidades";
        action = "Dividir em sub-módulos coesos seguindo o Princípio da Responsabilidade Única (SRP)";
      } else if (coupling > 15) {
        issue = "Alto acoplamento e dependências excessivas";
        action = "Injetar dependências via interfaces e introduzir camadas de abstração";
      }

      hotspots.push({
        file: f.path || f.label || "unknown",
        cyclomaticComplexity: complexity,
        linesOfCode: loc,
        couplingDegree: coupling,
        cognitiveLoad,
        estimatedEffortHours: hours,
        primaryIssue: issue,
        recommendedAction: action
      });
    }
  }

  hotspots.sort((a, b) => (b.cyclomaticComplexity * 2 + b.linesOfCode) - (a.cyclomaticComplexity * 2 + a.linesOfCode));
  const topRefactoringPriorities = hotspots.slice(0, 5);

  const fileCount = Math.max(1, fileNodes.length);
  const avgComplexity = Math.round((totalComplexity / fileCount) * 10) / 10;
  const testRatio = Math.round((testNodes.length / fileCount) * 100) / 100;

  // Maintainability Index (MI) computation
  // Simplified Halstead Volume estimation = N * log2(n) ~ LOC * 4.5
  const estimatedVolume = Math.max(1, totalLoc * 4.5);
  const rawMI = 171 - 5.2 * Math.log(estimatedVolume / fileCount) - 0.23 * avgComplexity - 16.2 * Math.log(Math.max(1, totalLoc / fileCount));
  const normalizedMI = Math.max(0, Math.min(100, Math.round((rawMI * 100) / 171)));

  let rating: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR" | "CRITICAL" = "EXCELLENT";
  let letterGrade: "A" | "B" | "C" | "D" | "F" = "A";
  let techDebt = Math.max(0, Math.min(100, 100 - normalizedMI + (godModulesCount * 5)));

  if (normalizedMI >= 80) {
    rating = "EXCELLENT";
    letterGrade = "A";
  } else if (normalizedMI >= 65) {
    rating = "GOOD";
    letterGrade = "B";
  } else if (normalizedMI >= 50) {
    rating = "MODERATE";
    letterGrade = "C";
  } else if (normalizedMI >= 35) {
    rating = "POOR";
    letterGrade = "D";
  } else {
    rating = "CRITICAL";
    letterGrade = "F";
  }

  const lowPct = Math.round((lowCount / fileCount) * 100);
  const modPct = Math.round((modCount / fileCount) * 100);
  const highPct = Math.round((highCount / fileCount) * 100);
  const extPct = Math.round((extremeCount / fileCount) * 100);

  return {
    repoUrl,
    maintainabilityIndex: normalizedMI,
    maintainabilityRating: rating,
    technicalDebtScore: techDebt,
    letterGrade,
    summary: {
      totalFiles: fileNodes.length,
      totalLinesOfCode: totalLoc,
      totalFunctions: nodes.filter((n) => n.kind === "function" || n.kind === "method").length,
      averageComplexityPerFile: avgComplexity,
      testToCodeRatio: testRatio,
      godModulesCount
    },
    cognitiveLoadDistribution: {
      low: lowPct,
      moderate: modPct,
      high: highPct,
      extreme: extPct
    },
    topRefactoringPriorities,
    isApplicable: true,
    message: `Índice de Manutenibilidade: ${normalizedMI}/100 (Nota ${letterGrade} - ${rating}). Identificados ${godModulesCount} God Modules e ${topRefactoringPriorities.length} arquivos prioritários para refatoração.`
  };
}
