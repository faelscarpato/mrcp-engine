import type { Analysis, GraphNode, GraphEdge } from "@/lib/graph-types";

/**
 * Computes the difference between two analyses
 */
export interface AnalysisDiff {
  // Nodes that exist in base but not in head (deleted)
  deletedNodes: GraphNode[];
  // Nodes that exist in head but not in base (added)
  addedNodes: GraphNode[];
  // Nodes that exist in both but have changes
  modifiedNodes: Array<{
    node: GraphNode;
    changes: {
      loc?: { base: number; head: number };
      complexity?: { base: number; head: number };
      language?: { base: string | undefined; head: string | undefined };
    };
  }>;
  // Edges that exist in base but not in head (deleted)
  deletedEdges: GraphEdge[];
  // Edges that exist in head but not in base (added)
  addedEdges: GraphEdge[];
  // Summary statistics
  summary: {
    nodesAdded: number;
    nodesDeleted: number;
    nodesModified: number;
    edgesAdded: number;
    edgesDeleted: number;
    locAdded: number;
    locRemoved: number;
    complexityIncreased: number;
    complexityDecreased: number;
  };
}

/**
 * Compute diff between two analyses
 * base: the original/older analysis
 * head: the new/updated analysis
 */
export function computeAnalysisDiff(
  base: Analysis,
  head: Analysis,
): AnalysisDiff {
  const baseNodeMap = new Map(base.nodes.map((n) => [n.id, n]));
  const headNodeMap = new Map(head.nodes.map((n) => [n.id, n]));
  const baseEdgeSet = new Set(
    base.edges.map((e) => `${e.source}->${e.target}`),
  );
  const headEdgeSet = new Set(
    head.edges.map((e) => `${e.source}->${e.target}`),
  );

  // Find deleted and added nodes
  const deletedNodes: GraphNode[] = [];
  const addedNodes: GraphNode[] = [];
  const commonNodes: GraphNode[] = [];

  for (const node of base.nodes) {
    if (!headNodeMap.has(node.id)) {
      deletedNodes.push(node);
    } else {
      commonNodes.push(node);
    }
  }

  for (const node of head.nodes) {
    if (!baseNodeMap.has(node.id)) {
      addedNodes.push(node);
    }
  }

  // Find modified nodes (compare properties)
  const modifiedNodes: Array<{
    node: GraphNode;
    changes: {
      loc?: { base: number; head: number };
      complexity?: { base: number; head: number };
      language?: { base: string | undefined; head: string | undefined };
    };
  }> = [];

  for (const node of commonNodes) {
    const headNode = headNodeMap.get(node.id)!;
    const changes: {
      loc?: { base: number; head: number };
      complexity?: { base: number; head: number };
      language?: { base: string | undefined; head: string | undefined };
    } = {};

    // Check LOC changes
    if (
      node.loc !== undefined &&
      headNode.loc !== undefined &&
      node.loc !== headNode.loc
    ) {
      changes.loc = { base: node.loc, head: headNode.loc };
    }

    // Check complexity changes
    if (
      node.complexity !== undefined &&
      headNode.complexity !== undefined &&
      node.complexity !== headNode.complexity
    ) {
      changes.complexity = { base: node.complexity, head: headNode.complexity };
    }

    // Check language changes
    if (node.language !== headNode.language) {
      changes.language = { base: node.language, head: headNode.language };
    }

    if (Object.keys(changes).length > 0) {
      modifiedNodes.push({ node: headNode, changes });
    }
  }

  // Find deleted and added edges
  const deletedEdges: GraphEdge[] = [];
  const addedEdges: GraphEdge[] = [];

  for (const edge of base.edges) {
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!headEdgeSet.has(edgeKey)) {
      deletedEdges.push(edge);
    }
  }

  for (const edge of head.edges) {
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!baseEdgeSet.has(edgeKey)) {
      addedEdges.push(edge);
    }
  }

  // Compute summary statistics
  const locAdded = addedNodes.reduce((sum, n) => sum + (n.loc ?? 0), 0);
  const locRemoved = deletedNodes.reduce((sum, n) => sum + (n.loc ?? 0), 0);

  const complexityIncreased = modifiedNodes
    .filter(
      (n) =>
        n.changes.complexity &&
        n.changes.complexity.head > (n.changes.complexity!.base ?? 0),
    )
    .reduce(
      (sum, n) =>
        sum + (n.changes.complexity!.head - (n.changes.complexity!.base ?? 0)),
      0,
    );

  const complexityDecreased = modifiedNodes
    .filter(
      (n) =>
        n.changes.complexity &&
        n.changes.complexity.head < (n.changes.complexity!.base ?? 0),
    )
    .reduce(
      (sum, n) =>
        sum + ((n.changes.complexity!.base ?? 0) - n.changes.complexity!.head),
      0,
    );

  return {
    deletedNodes,
    addedNodes,
    modifiedNodes,
    deletedEdges,
    addedEdges,
    summary: {
      nodesAdded: addedNodes.length,
      nodesDeleted: deletedNodes.length,
      nodesModified: modifiedNodes.length,
      edgesAdded: addedEdges.length,
      edgesDeleted: deletedEdges.length,
      locAdded,
      locRemoved,
      complexityIncreased,
      complexityDecreased,
    },
  };
}

/**
 * Format a diff for display
 */
export function formatDiffSummary(diff: AnalysisDiff): string {
  const parts: string[] = [];

  if (diff.summary.nodesAdded > 0) {
    parts.push(`+${diff.summary.nodesAdded} nodes`);
  }
  if (diff.summary.nodesDeleted > 0) {
    parts.push(`-${diff.summary.nodesDeleted} nodes`);
  }
  if (diff.summary.nodesModified > 0) {
    parts.push(`~${diff.summary.nodesModified} nodes`);
  }
  if (diff.summary.edgesAdded > 0) {
    parts.push(`+${diff.summary.edgesAdded} edges`);
  }
  if (diff.summary.edgesDeleted > 0) {
    parts.push(`-${diff.summary.edgesDeleted} edges`);
  }

  return parts.join(", ") || "No changes";
}
