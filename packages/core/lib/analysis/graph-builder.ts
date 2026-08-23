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
import {
  detectCycles,
  computeAdvancedMetrics,
  identifyGodModules,
  type CycleResult,
} from "./graph-advanced-metrics.js";

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
      const tsRes = await extractFunctionsWithTreeSitter(f.path, f.content, lang);
      functions = Array.isArray(tsRes) ? tsRes : (tsRes?.functions ?? []);
      if (!functions.length) {
        functions = await extractFunctionsFromCode(f.path, f.content, lang);
      }
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

export { computeMetrics } from "./graph-metrics.js";
import { computeMetrics } from "./graph-metrics.js";

export {
  detectCycles,
  computeAdvancedMetrics,
  identifyGodModules,
  type CycleResult
} from "./graph-advanced-metrics.js";
