import type {
  GraphEdge,
  GraphNode,
  AnalysisMetrics,
  NodeKind,
  AdvancedModuleMetrics,
  Cycle,
} from "@/lib/graph-types";
import type { PartialAnalysis } from "./types.js";
import {
  detectLanguage,
  isConfigFile,
  detectMonorepoConfig,
  resolveMonorepoRoots,
  type MonorepoConfig,
} from "./parsers/language.js";
import {
  countLines,
  estimateComplexity,
  extractImports,
  resolveImport,
  buildAliasMap,
  resolveImportOrAlias,
  type TsAliasEntry,
} from "./parsers/imports.js";
import {
  extractFunctionsFromCode,
  functionsToNodes,
  extractFunctionCalls,
  type ExtractedFunction,
} from "./parsers/functions.js";
import {
  extractFunctionsWithTreeSitter,
  extractImportsWithTreeSitter,
} from "./parsers/tree-sitter.js";

const ENTRYPOINT_PATTERNS = [
  /^src\/(main|index)\.(ts|tsx|js|jsx)$/,
  /^src\/routes\/__root\.(ts|tsx)$/,
  /^main\.(py|go)$/,
  /^cmd\/[^/]+\/main\.go$/,
  /^index\.(html|js|ts)$/,
];

export interface FileEntry {
  path: string;
  content?: string; // may be undefined when only tree was fetched
  size?: number;
}

export async function buildGraph(files: FileEntry[]): Promise<PartialAnalysis> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const languages: Record<string, number> = {};
  const fileSet = new Set(files.map((f) => f.path));

  // Detect monorepo configuration upfront. Detecting from fetched content
  // is best-effort: if config files weren't included (e.g. truncated), we
  // fall back to non-monorepo behavior.
  const monorepo = detectMonorepoConfig(files);
  const monorepoRoots = resolveMonorepoRoots(monorepo, files);

  // Build TypeScript/JS path-alias map from tsconfig.json files in the repo.
  const aliasMap: TsAliasEntry[] = buildAliasMap(files);

  // Group paths into top-level modules. When a monorepo is detected, files
  // under any detected root (`packages/ui/...`, `apps/web/...`) become a
  // module keyed by `packages/ui`; everything else uses first-level dir
  // detection (`src/x` → `src/x`, `lib.rs` → root).
  const moduleFor = (path: string): string => {
    for (const root of monorepoRoots) {
      // root has no trailing slash (resolveMonorepoRoots normalizes it)
      if (path === root || path.startsWith(root + "/")) {
        return root;
      }
    }
    const parts = path.split("/");
    if (parts[0] === "src" && parts.length > 2) return `src/${parts[1]}`;
    return parts.length > 1 ? parts[0] : "root";
  };
  const modules = new Map<string, GraphNode>();

  // First pass: create modules and files
  for (const f of files) {
    const modKey = moduleFor(f.path);
    if (!modules.has(modKey)) {
      const n: GraphNode = {
        id: `mod:${modKey}`,
        label: modKey.split("/").slice(-1)[0],
        kind: "module",
        group: modKey,
      };
      modules.set(modKey, n);
      nodes.push(n);
    }

    const lang = detectLanguage(f.path);
    if (lang) languages[lang] = (languages[lang] ?? 0) + 1;

    const loc = f.content ? countLines(f.content) : undefined;
    const complexity = f.content ? estimateComplexity(f.content) : undefined;
    const isEntry = ENTRYPOINT_PATTERNS.some((r) => r.test(f.path));
    const kind: NodeKind = isConfigFile(f.path) ? "config" : "file";

    const node: GraphNode = {
      id: `file:${f.path}`,
      label: f.path.split("/").pop() ?? f.path,
      kind,
      path: f.path,
      group: modKey,
      loc,
      complexity,
      language: lang,
      entrypoint: isEntry,
    };
    nodes.push(node);
    edges.push({
      source: modules.get(modKey)!.id,
      target: node.id,
      weight: 1,
      kind: "import",
    });
  }

  // Second pass: extract functions from files with content
  const functionNodes: GraphNode[] = [];
  const functionMap = new Map<string, GraphNode>();

  for (const f of files) {
    if (!f.content) continue;

    const lang = detectLanguage(f.path) || "";

    // Try Tree-sitter first for accurate AST-based extraction
    let functions: ExtractedFunction[];
    try {
      functions = await extractFunctionsWithTreeSitter(f.path, f.content, lang);
    } catch {
      // Fallback to regex-based extraction
      functions = await extractFunctionsFromCode(f.path, f.content, lang);
    }

    const funcNodes = functionsToNodes(functions);

    for (const funcNode of funcNodes) {
      // Link function to its file
      edges.push({
        source: `file:${f.path}`,
        target: funcNode.id,
        weight: 1,
        kind: "import",
      });

      // Link function to module
      const modKey = moduleFor(f.path);
      if (modules.has(modKey)) {
        edges.push({
          source: modules.get(modKey)!.id,
          target: funcNode.id,
          weight: 1,
          kind: "import",
        });
      }

      functionNodes.push(funcNode);
      functionMap.set(funcNode.id, funcNode);
    }
  }

  nodes.push(...functionNodes);

  // Externals: derived from imports. Try Tree-sitter first for accurate
  // resolution; fall back to regex-based extraction on any failure.
  const externals = new Map<string, GraphNode>();

  for (const f of files) {
    if (!f.content) continue;

    let imports = extractImports(f.path, f.content);
    if (imports.length > 0) {
      // Regex already found something — but try Tree-sitter for precision.
      try {
        const tsResult = await extractImportsWithTreeSitter(
          f.path,
          f.content,
          detectLanguage(f.path) ?? "",
        );
        if (tsResult.imports.length > 0) {
          // Merge: prefer Tree-sitter results; keep regex-only if Tree-sitter
          // returned nothing (e.g. unsupported language).
          imports = tsResult.imports;
        }
      } catch {
        // keep regex imports
      }
    }

    for (const imp of imports) {
      if (imp.isRelative) {
        const resolved = resolveImportOrAlias(
          f.path,
          imp.raw,
          fileSet,
          aliasMap,
        );
        if (resolved && resolved !== f.path) {
          edges.push({
            source: `file:${f.path}`,
            target: `file:${resolved}`,
            weight: 1,
            kind: "import",
          });
        }
      } else {
        const name = imp.raw
          .split("/")
          .slice(0, imp.raw.startsWith("@") ? 2 : 1)
          .join("/");
        if (!name) continue;
        const id = `ext:${name}`;
        if (!externals.has(id)) {
          const n: GraphNode = {
            id,
            label: name,
            kind: "external",
            group: "external",
          };
          externals.set(id, n);
          nodes.push(n);
        }
        edges.push({
          source: `file:${f.path}`,
          target: id,
          weight: 1,
          kind: "import",
        });
      }
    }
  }

  // Third pass: extract function calls to build call graph
  // with scope-aware resolution (same file > same module > external)
  for (const f of files) {
    if (!f.content) continue;

    const lang = detectLanguage(f.path) || "";
    const fileId = `file:${f.path}`;

    // Get all function nodes
    const allFunctionNodes = nodes.filter((n) => n.kind === "function");

    // Extract calls from this file with scope-aware resolution
    const callEdges = await extractFunctionCalls(
      f.path,
      fileId,
      f.content,
      lang,
      allFunctionNodes,
      moduleFor,
    );
    edges.push(...callEdges);
  }

  const metrics = computeMetrics(nodes, edges, languages);

  // Sprint 4: Advanced architecture metrics
  const modMetrics = computeAdvancedMetrics(nodes, edges, moduleFor);
  const cycles = detectCycles(nodes, edges, moduleFor);

  metrics.moduleMetrics = modMetrics;
  metrics.cycles = cycles.map((c) => ({
    nodes: c.nodes,
    moduleLabels: c.moduleLabels,
  }));

  const gods = identifyGodModules(modMetrics, nodes);
  metrics.godModules = gods;

  return {
    nodes,
    edges,
    languages,
    warnings: [],
    limitations: [],
    quality: files.some((f) => f.content) ? "full" : "partial",
    monorepo,
    monorepoRoots,
  };
}

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

// ---------------------------------------------------------------------------
// Sprint 4 — Tarjan SCC for cyclic dependency detection (2.8)
// ---------------------------------------------------------------------------

interface CycleResult {
  nodes: string[];
  moduleLabels: string[];
}

/**
 * Detect cyclic dependencies between modules using Tarjan's SCC algorithm.
 * Builds a module-level directed graph from edges, then finds strongly
 * connected components with more than 1 node (true cycles).
 *
 * Returns an array of cycles, each with node IDs and human-readable labels.
 */
export function detectCycles(
  nodes: GraphNode[],
  edges: GraphEdge[],
  moduleFor: (path: string) => string,
): CycleResult[] {
  // Build module-level adjacency: module → set of module IDs it depends on
  const moduleDeps = new Map<string, Set<string>>();
  const moduleNodeMap = new Map<string, string[]>();

  // Collect module nodes
  for (const n of nodes) {
    if (n.kind === "module" && n.id) {
      if (!moduleDeps.has(n.id)) moduleDeps.set(n.id, new Set());
      moduleNodeMap.set(n.id, moduleNodeMap.get(n.id) ?? []);
    }
  }

  // Map file/function nodes to their module
  const nodeToModule = new Map<string, string>();
  for (const n of nodes) {
    if (n.kind === "module") {
      nodeToModule.set(n.id, n.id);
    } else if (n.group) {
      const modId = `mod:${n.group}`;
      nodeToModule.set(n.id, modId);
    }
  }

  // Populate module deps from edges
  for (const e of edges) {
    const srcMod = nodeToModule.get(e.source);
    const tgtMod = nodeToModule.get(e.target);
    if (srcMod && tgtMod && srcMod !== tgtMod) {
      if (!moduleDeps.has(srcMod)) moduleDeps.set(srcMod, new Set());
      moduleDeps.get(srcMod)!.add(tgtMod);
    }
  }

  // Tarjan SCC
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: CycleResult[] = [];
  let currentIndex = 0;

  function strongConnect(v: string) {
    index.set(v, currentIndex);
    lowLink.set(v, currentIndex);
    currentIndex++;
    stack.push(v);
    onStack.add(v);

    const neighbors = moduleDeps.get(v);
    if (neighbors) {
      for (const w of neighbors) {
        if (!index.has(w)) {
          strongConnect(w);
          lowLink.set(v, Math.min(lowLink.get(v)!, lowLink.get(w)!));
        } else if (onStack.has(w)) {
          lowLink.set(v, Math.min(lowLink.get(v)!, index.get(w)!));
        }
      }
    }

    if (lowLink.get(v) === index.get(v)) {
      // Found a strongly connected component
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // Only report components with >1 node (true cycles)
      if (scc.length > 1) {
        cycles.push({
          nodes: scc,
          moduleLabels: scc.map((id) => {
            // Look up the node for its label
            const n = nodes.find((node) => node.id === id);
            return n?.label ?? id.replace("mod:", "");
          }),
        });
      }
    }
  }

  for (const modId of moduleDeps.keys()) {
    if (!index.has(modId)) {
      strongConnect(modId);
    }
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Sprint 4 — Advanced module metrics: Ca, Ce, I, A (2.9)
// ---------------------------------------------------------------------------

/**
 * Compute per-module architecture metrics:
 *   Ca (Afferent Coupling)  — modules outside this one that depend on it
 *   Ce (Efferent Coupling)  — modules this one depends on (outside itself)
 *   I  (Instability)         = Ce / (Ca + Ce); 0=stable, 1=unstable
 *   A  (Abstractness)        = (abstract + interface types) / total types
 *   D  (Distance)            = |A + I - 1|; 0=on main sequence, 1=far away
 */
export function computeAdvancedMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[],
  moduleFor: (path: string) => string,
): AdvancedModuleMetrics[] {
  // Collect modules
  const modules = new Set<string>();
  for (const n of nodes) {
    if (n.kind === "module" && n.group) modules.add(n.group);
  }

  // Map node → module
  const nodeToModule = new Map<string, string>();
  for (const n of nodes) {
    if (n.kind === "module" && n.group) {
      nodeToModule.set(n.id, n.group);
    } else if (n.group) {
      nodeToModule.set(n.id, n.group);
    }
  }

  // For each module, collect:
  //   - afferent (Ca): modules that depend on this module
  //   - efferent (Ce): modules this module depends on
  //   - total complexity of its nodes
  const ca = new Map<string, Set<string>>(); // module → set of depending modules
  const ce = new Map<string, Set<string>>(); // module → set of depended-on modules
  const moduleComplexity = new Map<string, number>();

  for (const mod of modules) {
    ca.set(mod, new Set());
    ce.set(mod, new Set());
    moduleComplexity.set(mod, 0);
  }

  // Process edges to compute coupling
  for (const e of edges) {
    const srcMod = nodeToModule.get(e.source);
    const tgtMod = nodeToModule.get(e.target);
    if (!srcMod || !tgtMod || srcMod === tgtMod) continue;

    // src depends on tgt
    if (ce.has(srcMod)) ce.get(srcMod)!.add(tgtMod);
    // tgt is depended on by src
    if (ca.has(tgtMod)) ca.get(tgtMod)!.add(srcMod);
  }

  // Sum complexity per module
  for (const n of nodes) {
    const mod = n.group;
    if (mod && moduleComplexity.has(mod)) {
      moduleComplexity.set(
        mod,
        (moduleComplexity.get(mod) ?? 0) + (n.complexity ?? 0),
      );
    }
  }

  // Compute abstractness A from node labels containing "abstract" or "interface"
  const abstractCount = new Map<string, number>();
  const totalTypes = new Map<string, number>();
  for (const mod of modules) {
    abstractCount.set(mod, 0);
    totalTypes.set(mod, 0);
  }
  for (const n of nodes) {
    if (n.kind !== "file" && n.kind !== "function") continue;
    const mod = nodeToModule.get(n.id);
    if (!mod || !totalTypes.has(mod)) continue;
    totalTypes.set(mod, (totalTypes.get(mod) ?? 0) + 1);
    const label = n.label.toLowerCase();
    if (
      label.startsWith("abstract") ||
      label.startsWith("interface") ||
      label.startsWith("i")
    ) {
      abstractCount.set(mod, (abstractCount.get(mod) ?? 0) + 1);
    }
  }

  const results: AdvancedModuleMetrics[] = [];

  for (const mod of modules) {
    const afferent = ca.get(mod)?.size ?? 0;
    const efferent = ce.get(mod)?.size ?? 0;
    const instability =
      afferent + efferent > 0 ? efferent / (afferent + efferent) : 0;
    const tot = totalTypes.get(mod) ?? 1;
    const abs = abstractCount.get(mod) ?? 0;
    const abstractness = tot > 0 ? abs / tot : 0;
    const distance = Math.abs(abstractness + instability - 1);

    results.push({
      module: mod,
      afferentCoupling: afferent,
      efferentCoupling: efferent,
      instability: Math.round(instability * 1000) / 1000,
      abstractness: Math.round(abstractness * 1000) / 1000,
      distance: Math.round(distance * 1000) / 1000,
      totalComplexity: moduleComplexity.get(mod) ?? 0,
    });
  }

  return results.sort((a, b) => b.instability - a.instability);
}

// ---------------------------------------------------------------------------
// Sprint 4 — God Module detection (2.10)
// ---------------------------------------------------------------------------

/**
 * Identify "God Modules" — modules with high afferent coupling (many dependents),
 * high efferent coupling (depends on many), and high complexity.
 *
 * A module is flagged if it exceeds the 75th percentile in at least 2 of 3 metrics:
 * Ca, Ce, or total complexity.
 */
export function identifyGodModules(
  moduleMetrics: AdvancedModuleMetrics[],
  nodes: GraphNode[],
): string[] {
  if (moduleMetrics.length < 3) return [];

  const sortedCa = [...moduleMetrics].sort(
    (a, b) => b.afferentCoupling - a.afferentCoupling,
  );
  const sortedCe = [...moduleMetrics].sort(
    (a, b) => b.efferentCoupling - a.efferentCoupling,
  );
  const sortedCx = [...moduleMetrics].sort(
    (a, b) => b.totalComplexity - a.totalComplexity,
  );

  const p75Idx = Math.floor(moduleMetrics.length * 0.75);
  const thresholdCa = sortedCa[p75Idx]?.afferentCoupling ?? 0;
  const thresholdCe = sortedCe[p75Idx]?.efferentCoupling ?? 0;
  const thresholdCx = sortedCx[p75Idx]?.totalComplexity ?? 0;

  const gods: string[] = [];
  for (const m of moduleMetrics) {
    let flags = 0;
    if (m.afferentCoupling >= thresholdCa) flags++;
    if (m.efferentCoupling >= thresholdCe) flags++;
    if (m.totalComplexity >= thresholdCx) flags++;
    if (flags >= 2) {
      gods.push(m.module);
      m.isGodModule = true;
    }
  }

  return gods;
}
