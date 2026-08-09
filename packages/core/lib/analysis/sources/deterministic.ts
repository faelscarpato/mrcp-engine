import type {
  AnalysisSource,
  PartialAnalysis,
  ProgressEvent,
  AnalysisContext,
} from "../types.js";
import type { GraphEdge, GraphNode, NodeKind } from "@/lib/graph-types";

const MODULE_NAMES = ["core", "api", "auth", "ui", "utils", "graph", "hooks"];
const FILE_NAMES = [
  "index",
  "types",
  "client",
  "server",
  "helpers",
  "config",
  "provider",
];
const EXTERNALS = ["react", "d3", "zod", "clsx"];

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const deterministicSource: AnalysisSource = {
  id: "deterministic",
  canRun: () => true,
  async run(
    ctx: AnalysisContext,
    onProgress: (p: ProgressEvent) => void,
  ): Promise<PartialAnalysis> {
    const seed = hash(`${ctx.owner}/${ctx.repo}@${ctx.branch}`);
    const rand = rng(seed);
    const steps: Array<[number, string]> = [
      [20, "Generating synthetic tree"],
      [50, "Simulating imports"],
      [80, "Computing heuristics"],
    ];
    for (const [pct, label] of steps) {
      onProgress({ pct, label, sourceId: "deterministic" });
      await new Promise((r) => setTimeout(r, 150 + rand() * 150));
    }

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const modCount = 4 + Math.floor(rand() * 4);
    const modules: GraphNode[] = [];
    for (let i = 0; i < modCount; i++) {
      const name = MODULE_NAMES[i % MODULE_NAMES.length];
      const n: GraphNode = {
        id: `mod:${name}-${i}`,
        label: name,
        kind: "module",
        group: name,
      };
      modules.push(n);
      nodes.push(n);
    }
    const files: GraphNode[] = [];
    modules.forEach((m) => {
      const c = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < c; i++) {
        const fn =
          FILE_NAMES[Math.floor(rand() * FILE_NAMES.length)] +
          (i ? `-${i}` : "");
        const path = `src/${m.label}/${fn}.ts`;
        const f: GraphNode = {
          id: `file:${path}`,
          label: `${fn}.ts`,
          kind: "file",
          path,
          group: m.group,
          loc: 30 + Math.floor(rand() * 300),
          complexity: 1 + Math.floor(rand() * 15),
        };
        files.push(f);
        nodes.push(f);
        edges.push({ source: m.id, target: f.id, weight: 1, kind: "import" });
      }
    });
    EXTERNALS.forEach((name) => {
      const n: GraphNode = {
        id: `ext:${name}`,
        label: name,
        kind: "external",
        group: "external",
      };
      nodes.push(n);
      const consumers = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < consumers; i++) {
        const f = files[Math.floor(rand() * files.length)];
        edges.push({ source: f.id, target: n.id, weight: 1, kind: "import" });
      }
    });

    return {
      nodes,
      edges,
      warnings: [
        "Structural heuristic only — enable a real source for accurate analysis.",
      ],
      limitations: [
        "Deterministic fallback: shape is derived from the URL, not the repository contents.",
      ],
      quality: "degraded",
    };
  },
};
