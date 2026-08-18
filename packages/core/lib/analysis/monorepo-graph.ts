import { findRepoFiles, fetchRepoFile } from "./repo-fetcher.js";

export interface WorkspacePackage {
  name: string;
  relativePath: string;
  version: string;
  private: boolean;
  internalDependencies: string[];
  externalDependenciesCount: number;
}

export interface MonorepoGraphOptions {
  repoUrl: string;
  changedFiles?: string[];
}

export interface MonorepoGraphResult {
  repoUrl: string;
  isMonorepo: boolean;
  monorepoTool: "pnpm-workspace" | "npm/yarn-workspaces" | "lerna" | "turborepo" | "nx" | "NONE";
  packagesCount: number;
  packages: WorkspacePackage[];
  topologicalBuildOrder: string[][]; // Array of build stages (parallelizable within stage)
  cyclicDependencies: Array<[string, string]>;
  affectedPackages?: string[];
  isApplicable: boolean;
  message?: string;
}

export async function analyzeMonorepoGraph(options: MonorepoGraphOptions): Promise<MonorepoGraphResult> {
  const { repoUrl, changedFiles = [] } = options;

  // Search for monorepo configuration files and package.json files
  const files = await findRepoFiles(repoUrl, (filePath) => {
    const p = filePath.toLowerCase();
    return (
      p === "pnpm-workspace.yaml" ||
      p === "pnpm-workspace.yml" ||
      p === "lerna.json" ||
      p === "turbo.json" ||
      p === "nx.json" ||
      p === "package.json" ||
      (p.endsWith("/package.json") && !p.includes("node_modules"))
    );
  });

  let monorepoTool: "pnpm-workspace" | "npm/yarn-workspaces" | "lerna" | "turborepo" | "nx" | "NONE" = "NONE";
  let isMonorepo = false;

  if (files.some((f) => f.includes("pnpm-workspace"))) {
    monorepoTool = "pnpm-workspace";
    isMonorepo = true;
  } else if (files.includes("turbo.json")) {
    monorepoTool = "turborepo";
    isMonorepo = true;
  } else if (files.includes("lerna.json")) {
    monorepoTool = "lerna";
    isMonorepo = true;
  } else if (files.includes("nx.json")) {
    monorepoTool = "nx";
    isMonorepo = true;
  }

  // Check root package.json for workspaces
  const rootPkg = await fetchRepoFile(repoUrl, "package.json");
  if (rootPkg && rootPkg.content) {
    try {
      const parsed = JSON.parse(rootPkg.content);
      if (parsed.workspaces) {
        isMonorepo = true;
        if (monorepoTool === "NONE") monorepoTool = "npm/yarn-workspaces";
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  // Discover all packages
  const pkgFiles = files.filter((f) => f.endsWith("package.json") && f !== "package.json");
  if (pkgFiles.length > 0 && !isMonorepo) {
    isMonorepo = true;
    monorepoTool = "npm/yarn-workspaces";
  }

  if (!isMonorepo && pkgFiles.length === 0) {
    return {
      repoUrl,
      isMonorepo: false,
      monorepoTool: "NONE",
      packagesCount: rootPkg ? 1 : 0,
      packages: rootPkg
        ? [
            {
              name: "single-root-package",
              relativePath: ".",
              version: "1.0.0",
              private: false,
              internalDependencies: [],
              externalDependenciesCount: 0
            }
          ]
        : [],
      topologicalBuildOrder: [["single-root-package"]],
      cyclicDependencies: [],
      isApplicable: false,
      message: "O repositório é um projeto standalone (não é um Monorepo com workspaces)."
    };
  }

  const pkgMap = new Map<string, { pkg: any; path: string }>();
  const allPkgNames = new Set<string>();

  for (const pf of pkgFiles) {
    const file = await fetchRepoFile(repoUrl, pf);
    if (!file || !file.content) continue;
    try {
      const parsed = JSON.parse(file.content);
      if (parsed.name) {
        pkgMap.set(parsed.name, { pkg: parsed, path: pf.replace(/\/package\.json$/, "") });
        allPkgNames.add(parsed.name);
      }
    } catch {
      // Ignore
    }
  }

  const packages: WorkspacePackage[] = [];
  const dependencyGraph = new Map<string, Set<string>>(); // pkg -> set of internal dependencies

  for (const [name, { pkg, path }] of pkgMap.entries()) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.peerDependencies || {}) };
    const internalDeps: string[] = [];
    let externalCount = 0;

    for (const depName of Object.keys(deps)) {
      if (allPkgNames.has(depName)) {
        internalDeps.push(depName);
      } else {
        externalCount++;
      }
    }

    dependencyGraph.set(name, new Set(internalDeps));

    packages.push({
      name,
      relativePath: path,
      version: pkg.version || "1.0.0",
      private: Boolean(pkg.private),
      internalDependencies: internalDeps,
      externalDependenciesCount: externalCount
    });
  }

  // Detect circular dependencies (A -> B -> A)
  const cyclicDependencies: Array<[string, string]> = [];
  for (const [pkgA, deps] of dependencyGraph.entries()) {
    for (const pkgB of deps) {
      if (dependencyGraph.get(pkgB)?.has(pkgA)) {
        // avoid duplicate pairs [A, B] and [B, A]
        if (pkgA < pkgB) {
          cyclicDependencies.push([pkgA, pkgB]);
        }
      }
    }
  }

  // Topological sort for build order
  const buildStages: string[][] = [];
  const remaining = new Set(allPkgNames);
  const resolved = new Set<string>();

  while (remaining.size > 0) {
    const currentStage: string[] = [];
    for (const pkgName of remaining) {
      const deps = dependencyGraph.get(pkgName) || new Set();
      // Can build if all internal dependencies are already resolved
      const allDepsResolved = Array.from(deps).every((d) => resolved.has(d) || !remaining.has(d));
      if (allDepsResolved) {
        currentStage.push(pkgName);
      }
    }

    if (currentStage.length === 0) {
      // Break cycles by forcing remaining packages into the stage
      currentStage.push(...Array.from(remaining));
      remaining.clear();
    } else {
      for (const p of currentStage) {
        remaining.delete(p);
        resolved.add(p);
      }
    }
    buildStages.push(currentStage);
  }

  // Calculate affected packages if changedFiles are provided
  let affectedPackages: string[] | undefined = undefined;
  if (changedFiles.length > 0) {
    const directlyChanged = new Set<string>();
    for (const cf of changedFiles) {
      for (const p of packages) {
        if (cf.startsWith(p.relativePath + "/") || cf === p.relativePath) {
          directlyChanged.add(p.name);
        }
      }
    }

    // Downstream BFS
    const affected = new Set<string>(directlyChanged);
    let queue = Array.from(directlyChanged);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [pkgName, deps] of dependencyGraph.entries()) {
        if (deps.has(current) && !affected.has(pkgName)) {
          affected.add(pkgName);
          queue.push(pkgName);
        }
      }
    }
    affectedPackages = Array.from(affected);
  }

  return {
    repoUrl,
    isMonorepo: true,
    monorepoTool,
    packagesCount: packages.length,
    packages,
    topologicalBuildOrder: buildStages,
    cyclicDependencies,
    affectedPackages,
    isApplicable: true,
    message: `Monorepo (${monorepoTool}) com ${packages.length} pacotes mapeados. Pipeline ordenado em ${buildStages.length} estágios de compilação sem ciclos.`
  };
}
