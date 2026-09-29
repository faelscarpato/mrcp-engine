import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

export interface CodeHealthOptions {
  repoUrl: string;
}

export interface RefactoringHotspot {
  file: string;
  cyclomaticComplexity: number;
  linesOfCode: number;
  /** `null` quando o grafo não traz fan-in; usar 0 ou 1 seria inventar dado. */
  couplingDegree: number | null;
  cognitiveLoad: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  estimatedEffortHours: number;
  primaryIssue: string;
  recommendedAction: string;
}

export interface CodeHealthResult {
  repoUrl: string;
  // `null` = etapa sem dado real (nenhum arquivo analisável). Nunca usar 0/100
  // como substituto: 100 significaria "repositório perfeito", o que é falso.
  maintainabilityIndex: number | null; // 0 - 100
  maintainabilityRating:
    "EXCELLENT" | "GOOD" | "MODERATE" | "POOR" | "CRITICAL" | null;
  technicalDebtScore: number | null; // 0 - 100 (lower is better)
  letterGrade: "A" | "B" | "C" | "D" | "F" | null;
  summary: {
    totalFiles: number | null;
    totalLinesOfCode: number | null;
    totalFunctions: number | null;
    averageComplexityPerFile: number | null;
    testToCodeRatio: number | null;
    godModulesCount: number | null;
  };
  cognitiveLoadDistribution: {
    low: number | null; // %
    moderate: number | null; // %
    high: number | null; // %
    extreme: number | null; // %
  };
  topRefactoringPriorities: RefactoringHotspot[];
  isApplicable: boolean;
  message?: string;
  /** Passos do cálculo que não puderam ser concluídos. */
  limitations?: string[];
}

export async function calculateCodeHealth(
  options: CodeHealthOptions,
): Promise<CodeHealthResult> {
  const { repoUrl } = options;

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];
  const edges: any[] = graphData?.analysis?.edges || graphData?.edges || [];

  const fileNodesAll = nodes.filter((n) => n.kind === "file");

  // Sem arquivo analisável não existe Maintainability Index: devolver 100 seria
  // afirmar que o repositório está perfeito quando na verdade nada foi medido.
  if (nodes.length === 0 || fileNodesAll.length === 0) {
    const emptySummary = {
      totalFiles: fileNodesAll.length,
      totalLinesOfCode: null,
      totalFunctions: null,
      averageComplexityPerFile: null,
      testToCodeRatio: null,
      godModulesCount: null,
    };
    return {
      repoUrl,
      maintainabilityIndex: null,
      maintainabilityRating: null,
      technicalDebtScore: null,
      letterGrade: null,
      summary: emptySummary,
      cognitiveLoadDistribution: {
        low: null,
        moderate: null,
        high: null,
        extreme: null,
      },
      topRefactoringPriorities: [],
      isApplicable: false,
      message: `Nenhum arquivo de código foi encontrado para avaliar a saúde do repositório (${nodes.length} nós no grafo, ${fileNodesAll.length} nós de arquivo). O Maintainability Index não pode ser calculado — métrica ausente, não zero.`,
      limitations: [
        "Maintainability Index, nota e carga cognitiva não calculados: nenhum arquivo de código foi analisado.",
        "Totais de linhas, funções e God Modules permanecem ausentes (null) por falta de fonte.",
      ],
    };
  }

  // collectedBeforeFallback: arquivos cujos LOC/complexidade realmente vieram do
  // grafo. Só eles entram no MI — inventar 50 LOC ou complexidade 5 para um nó
  // sem métrica inflaria artificialmente o índice.
  const collectedBeforeFallback: { loc: number; complexity: number }[] = [];
  const nodesWithoutMetrics: string[] = [];

  const testNodes = fileNodesAll.filter((n) => {
    const p = (n.path || n.label || "").toLowerCase();
    return (
      p.includes(".test.") ||
      p.includes(".spec.") ||
      p.includes("__tests__") ||
      p.includes("tests/")
    );
  });

  let totalLoc = 0;
  let totalComplexity = 0;
  let godModulesCount = 0;
  let lowCount = 0;
  let modCount = 0;
  let highCount = 0;
  let extremeCount = 0;

  const hotspots: RefactoringHotspot[] = [];

  for (const f of fileNodesAll) {
    const rawLoc = f.metrics?.loc ?? f.loc;
    const rawComplexity =
      f.metrics?.cyclomaticComplexity ?? f.metrics?.complexity ?? f.complexity;
    const rawCoupling = f.metrics?.fanIn ?? f.fanIn;

    // Sem métrica no grafo o valor é 0 (medida real de "nada coletado"), não 50
    // LOC e não complexidade 5. O arquivo continua sendo contado em
    // totalFiles, mas fica fora do cálculo do MI e é reportado em limitations.
    const hasLoc = typeof rawLoc === "number";
    const hasComplexity = typeof rawComplexity === "number";
    const isSynthetic = f.synthetic === true;
    // Nó sintético carrega loc/complexity plausíveis por construção, mas eles
    // não descrevem o repositório: tratamos como não medidos em todos os
    // agregados (total LOC, média, distribuição cognitiva, MI).
    const loc = hasLoc && !isSynthetic ? rawLoc : 0;
    const complexity = hasComplexity && !isSynthetic ? rawComplexity : 0;
    // Acoplamento ausente é `null`, não 1: um fan-in inventado inventaria também
    // o diagnóstico de "alto acoplamento" e as horas estimadas de refatoração.
    const coupling = typeof rawCoupling === "number" ? rawCoupling : null;

    totalLoc += loc;
    totalComplexity += complexity;

    // isGodModule vem do grafo e independe de LOC/complexidade: sempre vale.
    if (f.isGodModule) {
      godModulesCount++;
    }

    // Sem as duas medidas o arquivo não pode ser classificado nem entrar no MI.
    // Nó marcado como sintético também não: o loc/complexity dele veio de um
    // PRNG semeado pela URL (fallback determinístico), não da leitura do código.
    if (!hasLoc || !hasComplexity || isSynthetic) {
      nodesWithoutMetrics.push(f.path || f.label || f.id || "desconhecido");
      continue;
    }

    collectedBeforeFallback.push({ loc, complexity });

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

    if (complexity > 40 && loc > 500) {
      godModulesCount++;
    }

    if (complexity >= 15 || loc >= 250) {
      const hours =
        Math.round((complexity * 0.15 + (loc / 100) * 0.5) * 10) / 10;
      let issue = "Alta densidade de complexidade ciclomática";
      let action = "Decompor funções longas e extrair módulos auxiliares";

      if (loc > 600) {
        issue = "Arquivo monolítico com excesso de responsabilidades";
        action =
          "Dividir em sub-módulos coesos seguindo o Princípio da Responsabilidade Única (SRP)";
      } else if (coupling !== null && coupling > 15) {
        issue = "Alto acoplamento e dependências excessivas";
        action =
          "Injetar dependências via interfaces e introduzir camadas de abstração";
      }

      hotspots.push({
        file: f.path || f.label || "unknown",
        cyclomaticComplexity: complexity,
        linesOfCode: loc,
        couplingDegree: coupling,
        cognitiveLoad,
        estimatedEffortHours: hours,
        primaryIssue: issue,
        recommendedAction: action,
      });
    }
  }

  hotspots.sort(
    (a, b) =>
      b.cyclomaticComplexity * 2 +
      b.linesOfCode -
      (a.cyclomaticComplexity * 2 + a.linesOfCode),
  );
  const topRefactoringPriorities = hotspots.slice(0, 5);

  const fileCount = Math.max(1, fileNodesAll.length);
  // A média de complexidade só faz sentido sobre os arquivos efetivamente
  // medidos; dividir pelos arquivos sem métrica rebaixaria a média com zeros
  // que ninguém mediu.
  const measuredCount = collectedBeforeFallback.length;
  const avgComplexity =
    measuredCount > 0
      ? Math.round((totalComplexity / measuredCount) * 10) / 10
      : null;
  const testRatio = Math.round((testNodes.length / fileCount) * 100) / 100;

  // Maintainability Index (MI) computation following standard SEI per-file formulation.
  // Só arquivos com métrica real do grafo entram na média: usar o total de
  // arquivos com LOC/complexidade inventados (50/5) inflaria o índice.
  let totalFileMI = 0;
  for (const m of collectedBeforeFallback) {
    const fileLoc = m.loc;
    const fileFnComp = m.complexity;
    const fileVol = Math.max(1, fileLoc * 4.5);
    const rawFileMI =
      171 -
      5.2 * Math.log(fileVol) -
      0.23 * fileFnComp -
      16.2 * Math.log(Math.max(1, fileLoc));
    const fileNormalizedMI = Math.max(
      20,
      Math.min(100, Math.round(rawFileMI * 1.5 + 10)),
    );
    totalFileMI += fileNormalizedMI;
  }

  // Sem nenhum arquivo com métrica coletada não existe MI. 100 seria a nota
  // máxima e affirmaria qualidade perfeita sem uma única medição.
  const normalizedMI =
    collectedBeforeFallback.length > 0
      ? Math.round(totalFileMI / collectedBeforeFallback.length)
      : null;

  let rating: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR" | "CRITICAL" | null =
    null;
  let letterGrade: "A" | "B" | "C" | "D" | "F" | null = null;
  const techDebt =
    normalizedMI === null
      ? null
      : Math.max(0, Math.min(100, 100 - normalizedMI + godModulesCount * 5));

  if (normalizedMI !== null) {
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
  }

  // As percentuais de carga cognitiva cobrem só os arquivos classificados; os
  // sem métrica não são "baixa carga", são desconhecidos.
  const classifiedCount = lowCount + modCount + highCount + extremeCount;
  const cognitiveBase = Math.max(1, classifiedCount);
  const lowPct =
    classifiedCount > 0 ? Math.round((lowCount / cognitiveBase) * 100) : null;
  const modPct =
    classifiedCount > 0 ? Math.round((modCount / cognitiveBase) * 100) : null;
  const highPct =
    classifiedCount > 0 ? Math.round((highCount / cognitiveBase) * 100) : null;
  const extPct =
    classifiedCount > 0
      ? Math.round((extremeCount / cognitiveBase) * 100)
      : null;

  const limitations: string[] = [];
  if (normalizedMI === null) {
    limitations.push(
      `Maintainability Index, nota, rating e dívida técnica não calculados: ${fileNodesAll.length} arquivo(s) no grafo, mas nenhum com LOC ou complexidade coletados.`,
    );
  } else if (nodesWithoutMetrics.length > 0) {
    const sample = nodesWithoutMetrics.slice(0, 5).join(", ");
    limitations.push(
      `${nodesWithoutMetrics.length} de ${fileNodesAll.length} arquivo(s) vieram sem LOC/complexidade e ficaram fora do cálculo do MI (amostra: ${sample}).`,
    );
  }

  return {
    repoUrl,
    maintainabilityIndex: normalizedMI,
    maintainabilityRating: rating,
    technicalDebtScore: techDebt,
    letterGrade,
    summary: {
      totalFiles: fileNodesAll.length,
      // Zero aqui significaria "medimos e o repositório tem 0 linhas". Quando
      // nenhum nó contribuiu com métrica real (grafo vazio de métricas ou
      // integralmente sintético), a resposta honesta é null.
      totalLinesOfCode: measuredCount > 0 ? totalLoc : null,
      totalFunctions: nodes.filter(
        (n) => n.kind === "function" || n.kind === "method",
      ).length,
      averageComplexityPerFile: avgComplexity,
      testToCodeRatio: testRatio,
      godModulesCount,
    },
    cognitiveLoadDistribution: {
      low: lowPct,
      moderate: modPct,
      high: highPct,
      extreme: extPct,
    },
    topRefactoringPriorities,
    // Há arquivos no grafo, então a etapa é aplicável; o que falta são as
    // métricas. A ausência fica em `limitations` e nos campos `null`, não em
    // um isApplicable falso que esconderia que o grafo existe.
    isApplicable: true,
    message:
      normalizedMI === null
        ? `Saúde de código sem dados medidos: ${fileNodesAll.length} arquivo(s) no grafo, nenhum com LOC ou complexidade coletados. Maintainability Index, nota e dívida técnica permanecem ausentes (null).`
        : `Índice de Manutenibilidade: ${normalizedMI}/100 (Nota ${letterGrade} - ${rating}). Identificados ${godModulesCount} God Modules e ${topRefactoringPriorities.length} arquivos prioritários para refatoração.`,
    limitations,
  };
}
