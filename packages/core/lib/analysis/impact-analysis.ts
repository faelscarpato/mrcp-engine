import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

export interface ImpactAnalysisOptions {
  repoUrl: string;
  modifiedFiles: string[];
  diffContent?: string;
}

export interface ImpactedNodeDetail {
  nodeId: string;
  path: string;
  impactType: "DIRECT" | "TRANSITIVE_DEPENDENCY" | "TEST_SUITE" | "PUBLIC_API_BREAK";
  depth: number;
  riskScore: number;
}

export interface ImpactAnalysisResult {
  repoUrl: string;
  blastRadiusScore: number;
  modifiedFilesCount: number;
  totalDownstreamImpactedNodes: number;
  impactedNodes: ImpactedNodeDetail[];
  impactedUnitTestFiles: string[];
  publicContractBreakingRisk: boolean;
  recommendations: string[];
}

export async function calculateImpactAnalysis(options: ImpactAnalysisOptions): Promise<ImpactAnalysisResult> {
  const { repoUrl, modifiedFiles, diffContent } = options;

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

  // Construit mapa de dependências inversas (nós a jusante que importam o nó alterado)
  const dependentsMap = new Map<string, string[]>();
  for (const edge of edges) {
    // edge: source -> target (source importa target)
    // Se target for modificado, source é impactado a jusante
    const target = edge.target;
    const source = edge.source;
    if (!dependentsMap.has(target)) {
      dependentsMap.set(target, []);
    }
    dependentsMap.get(target)!.push(source);
  }

  const impactedMap = new Map<string, ImpactedNodeDetail>();
  const queue: { nodeId: string; depth: number }[] = [];
  const unitTestFiles = new Set<string>();

  // Inicializa a fila com os arquivos modificados diretamente
  for (const file of modifiedFiles) {
    const matchingNode = nodes.find(
      (n: any) => n.path === file || n.id === `file:${file}` || n.label === file
    );
    const nodeId = matchingNode ? matchingNode.id : `file:${file}`;

    impactedMap.set(nodeId, {
      nodeId,
      path: file,
      impactType: "DIRECT",
      depth: 0,
      riskScore: 95
    });

    queue.push({ nodeId, depth: 0 });
  }

  // BFS para calcular a propagação do raio de impacto
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (depth >= 4) continue; // Limita a profundidade máxima de análise

    const dependents = dependentsMap.get(nodeId) || [];
    for (const depId of dependents) {
      if (!impactedMap.has(depId)) {
        const depNode = nodes.find((n: any) => n.id === depId);
        const depPath = depNode?.path || depId.replace(/^file:/, "");

        const isTest =
          depPath.includes(".test.") ||
          depPath.includes(".spec.") ||
          depPath.includes("/test/") ||
          depPath.includes("/tests/");

        if (isTest) {
          unitTestFiles.add(depPath);
        }

        const impactType = isTest ? "TEST_SUITE" : "TRANSITIVE_DEPENDENCY";
        const riskScore = Math.max(10, 80 - depth * 20);

        impactedMap.set(depId, {
          nodeId: depId,
          path: depPath,
          impactType,
          depth: depth + 1,
          riskScore
        });

        queue.push({ nodeId: depId, depth: depth + 1 });
      }
    }
  }

  const impactedList = Array.from(impactedMap.values());
  const directCount = modifiedFiles.length;
  const transitiveCount = impactedList.length - directCount;

  const blastRadiusScore = Math.min(
    100,
    Math.round(directCount * 15 + transitiveCount * 8 + unitTestFiles.size * 5)
  );

  const publicContractBreakingRisk =
    diffContent ? diffContent.includes("export ") || diffContent.includes("interface ") || diffContent.includes("type ") : false;

  const recommendations: string[] = [];
  if (unitTestFiles.size > 0) {
    recommendations.push(
      `Execute as suítes de teste afetadas: ${Array.from(unitTestFiles).slice(0, 3).join(", ")}`
    );
  } else {
    recommendations.push(
      "Atenção: Nenhuma suíte de testes existente cobre os módulos afetados a jusante."
    );
  }

  if (blastRadiusScore > 70) {
    recommendations.push(
      "Alto Raio de Impacto (Blast Radius > 70): Recomenda-se revisão por pares e testes de regressão de integração."
    );
  }

  if (publicContractBreakingRisk) {
    recommendations.push(
      "Risco de Breaking Change: O diff inclui alteração de exportações/contratos públicos."
    );
  }

  return {
    repoUrl,
    blastRadiusScore,
    modifiedFilesCount: directCount,
    totalDownstreamImpactedNodes: transitiveCount,
    impactedNodes: impactedList,
    impactedUnitTestFiles: Array.from(unitTestFiles),
    publicContractBreakingRisk,
    recommendations
  };
}
