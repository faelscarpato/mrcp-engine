import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

export interface ArchitectureDriftOptions {
  repoUrl: string;
  architectureType?:
    "CLEAN_ARCHITECTURE" | "HEXAGONAL" | "FEATURE_FIRST" | "LAYERED";
  maxAllowedCyclicDependencies?: number;
}

export interface ArchitectureViolation {
  ruleId: string;
  sourceModule: string;
  targetModule: string;
  violationType:
    | "UNAUTHORIZED_CROSS_LAYER_IMPORT"
    | "CIRCULAR_DEPENDENCY"
    | "GOD_MODULE_EXPANSION";
  severity: "WARNING" | "ERROR";
  explanation: string;
}

export interface ArchitectureDriftResult {
  repoUrl: string;
  architectureType: string;
  complianceScore: number;
  cyclicDependenciesFound: number;
  violations: ArchitectureViolation[];
}

export async function detectArchitectureDrift(
  options: ArchitectureDriftOptions,
): Promise<ArchitectureDriftResult> {
  const {
    repoUrl,
    architectureType = "CLEAN_ARCHITECTURE",
    maxAllowedCyclicDependencies = 0,
  } = options;

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

  const violations: ArchitectureViolation[] = [];
  let cyclicCount = 0;

  // 1. Detecção de Ciclos Diretos (A -> B e B -> A)
  const edgeSet = new Set<string>();
  for (const edge of edges) {
    edgeSet.add(`${edge.source}->${edge.target}`);
  }

  for (const edge of edges) {
    const reverseKey = `${edge.target}->${edge.source}`;
    if (edgeSet.has(reverseKey) && edge.source < edge.target) {
      cyclicCount++;
      violations.push({
        ruleId: "ARCH-CYCLIC-001",
        sourceModule: edge.source,
        targetModule: edge.target,
        violationType: "CIRCULAR_DEPENDENCY",
        severity: "ERROR",
        explanation: `Dependência circular direta detectada entre ${edge.source} e ${edge.target}.`,
      });
    }
  }

  // 2. Validação de Regras de Camadas (Clean Architecture)
  for (const edge of edges) {
    const src = edge.source.toLowerCase();
    const tgt = edge.target.toLowerCase();

    // Regra: Módulos de domínio/core não devem importar módulos de infraestrutura/UI
    if (
      (src.includes("core") || src.includes("domain")) &&
      (tgt.includes("ui") || tgt.includes("app") || tgt.includes("vscode"))
    ) {
      violations.push({
        ruleId: "ARCH-LAYER-002",
        sourceModule: edge.source,
        targetModule: edge.target,
        violationType: "UNAUTHORIZED_CROSS_LAYER_IMPORT",
        severity: "ERROR",
        explanation: `Violação da Clean Architecture: Módulo de núcleo/domínio (${edge.source}) importando módulo de camada externa (${edge.target}).`,
      });
    }
  }

  // 3. Verificação de expansão de God Modules
  for (const node of nodes) {
    if (node.complexity && node.complexity > 110) {
      violations.push({
        ruleId: "ARCH-GOD-003",
        sourceModule: node.id,
        targetModule: node.group || "root",
        violationType: "GOD_MODULE_EXPANSION",
        severity: "WARNING",
        explanation: `God Module em expansão detectado: ${node.path || node.label} com complexidade ${node.complexity}.`,
      });
    }
  }

  const penalty = violations.reduce(
    (acc, v) => acc + (v.severity === "ERROR" ? 15 : 5),
    0,
  );
  const complianceScore = Math.max(0, 100 - penalty);

  return {
    repoUrl,
    architectureType,
    complianceScore,
    cyclicDependenciesFound: cyclicCount,
    violations,
  };
}
