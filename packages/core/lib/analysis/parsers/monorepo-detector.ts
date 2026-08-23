import type { MonorepoConfig } from "../types.js";

const GLOB_LEADING_SLASH = /^\//;

function normalizeGlob(g: string): string {
  return g.replace(GLOB_LEADING_SLASH, "").replace(/\/+$/, "");
}

function parseGlobs(raw: unknown): string[] {
  if (typeof raw === "string") return [normalizeGlob(raw)];
  if (Array.isArray(raw)) return raw.map((g) => normalizeGlob(String(g)));
  return [];
}

export function detectMonorepoConfig(
  files: Array<{ path: string; content?: string }>,
): MonorepoConfig {
  const fileMap = new Map<string, { content?: string }>();
  for (const f of files) fileMap.set(f.path, f);

  const has = (p: string) => fileMap.has(p);
  const read = (p: string): string | undefined => fileMap.get(p)?.content;

  // 1. pnpm-workspace.yaml
  const pnpmPath = ["pnpm-workspace.yaml", "pnpm-workspace.yml"].find(has);
  if (pnpmPath) {
    const text = read(pnpmPath) ?? "";
    const globs: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*-\s+["']?([^"'\s#]+)["']?\s*(?:#.*)?$/);
      if (m) globs.push(normalizeGlob(m[1]));
    }
    return { tool: "pnpm", roots: globs };
  }

  // 2. root package.json workspaces
  const rootPkg = read("package.json");
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg) as Record<string, unknown>;
      const ws = pkg.workspaces;
      if (ws) {
        const globs = parseGlobs(ws);
        if (globs.length > 0) {
          if (has("turbo.json")) return { tool: "turbo", roots: globs };
          if (has("nx.json")) return { tool: "nx", roots: globs };
          return { tool: "npm", roots: globs };
        }
      }
    } catch {
      // ignore malformed package.json
    }
  }

  // 3. turbo.json
  if (has("turbo.json")) {
    const turboText = read("turbo.json");
    let globs: string[] = [];
    if (turboText) {
      try {
        const turbo = JSON.parse(turboText) as Record<string, unknown>;
        if (Array.isArray(turbo.workspace)) globs = parseGlobs(turbo.workspace);
      } catch {
        // ignore
      }
    }
    return { tool: "turbo", roots: globs };
  }

  // 4. nx.json
  if (has("nx.json")) {
    return { tool: "nx", roots: [] };
  }

  // 5. go.work
  if (has("go.work")) {
    const text = read("go.work") ?? "";
    const roots: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*use\s+([^\s]+)/);
      if (m) {
        let r = m[1].replace(/^"|"$/g, "");
        r = r.replace(GLOB_LEADING_SLASH, "").replace(/\/+$/, "");
        if (r) roots.push(r);
      }
    }
    return { tool: "go-work", roots };
  }

  // 6. Cargo.toml
  const cargoPath = ["Cargo.toml", "cargo.toml"].find(has);
  if (cargoPath) {
    const text = read(cargoPath) ?? "";
    let inWorkspace = false;
    const roots: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const sec = line.match(/^\s*\[(.+)\]\s*$/);
      if (sec) {
        inWorkspace = sec[1] === "workspace";
        continue;
      }
      if (!inWorkspace) continue;
      const m = line.match(/^\s*members\s*=\s*(.+)$/);
      if (m) {
        const list = m[1].matchAll(/"([^"]+)"/g);
        for (const mm of list) {
          roots.push(normalizeGlob(mm[1]));
        }
      }
    }
    if (inWorkspace || roots.length > 0)
      return { tool: "cargo-workspace", roots };
  }

  // 7. lerna.json
  if (has("lerna.json")) {
    const text = read("lerna.json") ?? "";
    let globs: string[] = [];
    if (text) {
      try {
        const lerna = JSON.parse(text) as Record<string, unknown>;
        if (lerna.packages) globs = parseGlobs(lerna.packages);
      } catch {
        // ignore
      }
    }
    return { tool: "lerna", roots: globs };
  }

  return { tool: "none", roots: [] };
}

function expandGlob(glob: string, allPaths: Iterable<string>): string[] {
  const star = glob.match(/^(.+?)\/\*$/);
  if (!star) return [glob];

  const dirPrefix = star[1] + "/";
  const found = new Set<string>();
  for (const p of allPaths) {
    if (!p.startsWith(dirPrefix)) continue;
    const rest = p.slice(dirPrefix.length);
    if (!rest) continue;
    const first = rest.split("/")[0];
    if (first) found.add(dirPrefix + first);
  }
  return found.size > 0 ? [...found] : [glob];
}

export function resolveMonorepoRoots(
  config: MonorepoConfig,
  files: Array<{ path: string }>,
): string[] {
  if (config.tool === "none" || config.roots.length === 0) return [];
  const allPaths = files.map((f) => f.path);
  const expanded = new Set<string>();
  for (const g of config.roots) {
    for (const r of expandGlob(g, allPaths)) expanded.add(r);
  }
  return [...expanded].sort((a, b) => b.length - a.length);
}
