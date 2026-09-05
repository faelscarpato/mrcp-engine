import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

export interface DeadCodePrunerOptions {
  repoUrl: string;
}

export interface DeadSymbol {
  symbolName: string;
  filePath: string;
  type: "UNUSED_EXPORT" | "DEAD_VARIABLE" | "UNREFERENCED_FUNCTION";
  line: number;
}

export interface DeadCodePrunerResult {
  repoUrl: string;
  totalDeadSymbolsFound: number;
  estimatedBytesRemovable: number;
  deadSymbols: DeadSymbol[];
  pruneRecommendationCommand: string;
}

export async function findDeadCode(
  options: DeadCodePrunerOptions,
): Promise<DeadCodePrunerResult> {
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

  const targetEdges = new Set(edges.map((e: any) => e.target));
  const deadSymbols: DeadSymbol[] = [];

  for (const node of nodes) {
    if (
      node.kind === "file" &&
      !targetEdges.has(node.id) &&
      !node.entrypoint &&
      !node.path?.includes("index")
    ) {
      deadSymbols.push({
        symbolName: node.label || node.id,
        filePath: node.path || node.label || "",
        type: "UNUSED_EXPORT",
        line: 1,
      });
    }
  }

  return {
    repoUrl,
    totalDeadSymbolsFound: deadSymbols.length,
    estimatedBytesRemovable: deadSymbols.length * 1200,
    deadSymbols,
    pruneRecommendationCommand: "npx mrcp-engine prune --auto",
  };
}
