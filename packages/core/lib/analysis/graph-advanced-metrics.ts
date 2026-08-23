import type {
  GraphEdge,
  GraphNode,
  AdvancedModuleMetrics,
} from "@/lib/graph-types";

export interface CycleResult {
  nodes: string[];
  moduleLabels: string[];
}

export function detectCycles(
  nodes: GraphNode[],
  edges: GraphEdge[],
  moduleFor: (path: string) => string,
): CycleResult[] {
  const moduleDeps = new Map<string, Set<string>>();
  const moduleNodeMap = new Map<string, string[]>();

  for (const n of nodes) {
    if (n.kind === "module" && n.id) {
      if (!moduleDeps.has(n.id)) moduleDeps.set(n.id, new Set());
      moduleNodeMap.set(n.id, moduleNodeMap.get(n.id) ?? []);
    }
  }

  const nodeToModule = new Map<string, string>();
  for (const n of nodes) {
    if (n.kind === "module") {
      nodeToModule.set(n.id, n.id);
    } else if (n.group) {
      const modId = `mod:${n.group}`;
      nodeToModule.set(n.id, modId);
    }
  }

  for (const e of edges) {
    const srcMod = nodeToModule.get(e.source);
    const tgtMod = nodeToModule.get(e.target);
    if (srcMod && tgtMod && srcMod !== tgtMod) {
      if (!moduleDeps.has(srcMod)) moduleDeps.set(srcMod, new Set());
      moduleDeps.get(srcMod)!.add(tgtMod);
    }
  }

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
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      if (scc.length > 1) {
        cycles.push({
          nodes: scc,
          moduleLabels: scc.map((id) => {
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

export function computeAdvancedMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[],
  moduleFor: (path: string) => string,
): AdvancedModuleMetrics[] {
  const modules = new Set<string>();
  for (const n of nodes) {
    if (n.kind === "module" && n.group) modules.add(n.group);
  }

  const nodeToModule = new Map<string, string>();
  for (const n of nodes) {
    if (n.kind === "module" && n.group) {
      nodeToModule.set(n.id, n.group);
    } else if (n.group) {
      nodeToModule.set(n.id, n.group);
    }
  }

  const ca = new Map<string, Set<string>>();
  const ce = new Map<string, Set<string>>();
  const moduleComplexity = new Map<string, number>();

  for (const mod of modules) {
    ca.set(mod, new Set());
    ce.set(mod, new Set());
    moduleComplexity.set(mod, 0);
  }

  for (const e of edges) {
    const srcMod = nodeToModule.get(e.source);
    const tgtMod = nodeToModule.get(e.target);
    if (!srcMod || !tgtMod || srcMod === tgtMod) continue;

    if (ce.has(srcMod)) ce.get(srcMod)!.add(tgtMod);
    if (ca.has(tgtMod)) ca.get(tgtMod)!.add(srcMod);
  }

  for (const n of nodes) {
    const mod = n.group;
    if (mod && moduleComplexity.has(mod)) {
      moduleComplexity.set(
        mod,
        (moduleComplexity.get(mod) ?? 0) + (n.complexity ?? 0),
      );
    }
  }

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
