import type {
  GraphEdge,
  GraphNode,
  AnalysisMetrics,
  NodeKind,
} from "@/lib/graph-types";

export function computeMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[],
  languages?: Record<string, number>,
): AnalysisMetrics {
  const counts: Record<NodeKind, number> = {
    module: 0,
    file: 0,
    function: 0,
    external: 0,
    config: 0,
  };
  const degree = new Map<string, number>();
  for (const n of nodes) counts[n.kind] += 1;
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const avgDegree = nodes.length
    ? [...degree.values()].reduce((a, b) => a + b, 0) / nodes.length
    : 0;
  const density =
    nodes.length > 1 ? edges.length / (nodes.length * (nodes.length - 1)) : 0;
  const maxComplexity = nodes.reduce(
    (m, n) => Math.max(m, n.complexity ?? 0),
    0,
  );

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const topByDegree = [...degree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, deg]) => ({
      id,
      label: nodeMap.get(id)?.label ?? id,
      degree: deg,
    }));

  const hotspots = nodes
    .filter((n) => (n.complexity ?? 0) > 0)
    .sort((a, b) => (b.complexity ?? 0) - (a.complexity ?? 0))
    .slice(0, 5)
    .map((n) => ({ id: n.id, label: n.label, complexity: n.complexity ?? 0 }));

  return {
    nodes: nodes.length,
    edges: edges.length,
    modules: counts.module,
    files: counts.file,
    functions: counts.function,
    externals: counts.external,
    avgDegree: Math.round(avgDegree * 100) / 100,
    density: Math.round(density * 10000) / 10000,
    maxComplexity,
    warnings: [],
    topByDegree,
    hotspots,
    languages,
  };
}
