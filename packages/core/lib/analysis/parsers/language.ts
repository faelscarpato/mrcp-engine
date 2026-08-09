const EXT_LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  cpp: "C++",
  c: "C",
  h: "C",
  swift: "Swift",
  vue: "Vue",
  svelte: "Svelte",
  scala: "Scala",
  json: "JSON",
  md: "Markdown",
  yml: "YAML",
  yaml: "YAML",
  toml: "TOML",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  // Additional languages
  sh: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  lua: "Lua",
  perl: "Perl",
  pl: "Perl",
  dart: "Dart",
  elixir: "Elixir",
  exs: "Elixir",
  ex: "Elixir",
  erlang: "Erlang",
  hrl: "Erlang",
  haskell: "Haskell",
  hs: "Haskell",
  clojure: "Clojure",
  clj: "Clojure",
  cljs: "ClojureScript",
  fsharp: "F#",
  fs: "F#",
  objectivec: "Objective-C",
  mm: "Objective-C",
  matlab: "MATLAB",
  m: "MATLAB",
  r: "R",
  julia: "Julia",
  jl: "Julia",
  solidity: "Solidity",
  sol: "Solidity",
  sql: "SQL",
  graphql: "GraphQL",
  gql: "GraphQL",
  proto: "Protocol Buffers",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  cmake: "CMake",
  cbl: "COBOL",
  cob: "COBOL",
  cpy: "COBOL",
  pas: "Pascal",
  pp: "Pascal",
  inc: "Pascal",
};

export const SOURCE_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "rb",
  "php",
  "cs",
  "cpp",
  "c",
  "swift",
  "vue",
  "svelte",
  "scala",
  // Additional source file extensions
  "sh",
  "bash",
  "zsh",
  "lua",
  "pl",
  "perl",
  "dart",
  "exs",
  "ex",
  "erlang",
  "hrl",
  "hs",
  "haskell",
  "clj",
  "cljs",
  "clojure",
  "fs",
  "fsharp",
  "mm",
  "objectivec",
  "m",
  "matlab",
  "r",
  "jl",
  "julia",
  "sol",
  "solidity",
  "sql",
  "gql",
  "graphql",
  "proto",
  "cbl",
  "cob",
  "cpy",
  "pas",
  "pp",
  "inc",
]);

export const CONFIG_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.ts",
  "webpack.config.js",
  ".eslintrc.json",
  "tailwind.config.js",
  "tailwind.config.ts",
  // Monorepo / workspace config files (also kept for analysis)
  "pnpm-workspace.yaml",
  "turbo.json",
  "nx.json",
  "go.work",
  "lerna.json",
]);

export function detectLanguage(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? EXT_LANG[ext] : undefined;
}

export function isSourceFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return !!ext && SOURCE_EXTS.has(ext);
}

export function isConfigFile(path: string): boolean {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  return CONFIG_FILES.has(name);
}

/**
 * Monorepo detection result.
 * - `tool`: which monorepo tool was detected
 * - `roots`: explicit workspace root directories relative to repo root.
 *   Empty array means "single-package repo" or "tool present but no globs".
 *   The repo root itself is NOT included; callers prepend it when needed.
 */
export interface MonorepoConfig {
  tool:
    | "pnpm"
    | "npm"
    | "yarn"
    | "turbo"
    | "nx"
    | "go-work"
    | "cargo-workspace"
    | "lerna"
    | "none";
  roots: string[];
}

// Workspace glob patterns we recognize. Examples: "packages/*", "apps/*",
// "libs/**". We expand only the simple non-recursive `dir/*` form into
// concrete roots (using the file set we already have); recursive `**`
// globs are kept as-is and resolved lazily by `moduleFor`.
interface WorkspaceGlobs {
  tool: MonorepoConfig["tool"];
  globs: string[];
}

const GLOB_LEADING_SLASH = /^\//;

function normalizeGlob(g: string): string {
  return g.replace(GLOB_LEADING_SLASH, "").replace(/\/+$/, "");
}

function parseGlobs(raw: unknown): string[] {
  if (typeof raw === "string") return [normalizeGlob(raw)];
  if (Array.isArray(raw)) return raw.map((g) => normalizeGlob(String(g)));
  return [];
}

/**
 * Detect monorepo configuration from fetched files.
 *
 * Looks for (in priority order):
 *  1. `pnpm-workspace.yaml`                → pnpm
 *  2. root `package.json` with `workspaces`→ npm (or yarn, indistinguishable)
 *  3. `turbo.json`                         → turbo (roots inferred from root package.json workspaces if present)
 *  4. `nx.json`                            → nx (same inference as turbo)
 *  5. `go.work`                            → go-work (uses `use` directives)
 *  6. root `Cargo.toml` with `[workspace]` → cargo-workspace (members)
 *  7. `lerna.json`                         → lerna (packages field)
 *
 * Returns `{ tool: "none", roots: [] }` for normal single-package repos.
 */
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
      // Lines like: "  - packages/*" or "  - 'apps/*'"
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
          // Detect turbo/nx ornaments on top of npm/yarn workspaces
          if (has("turbo.json")) return { tool: "turbo", roots: globs };
          if (has("nx.json")) return { tool: "nx", roots: globs };
          // Heuristic: presence of yarn.lock is not knowable from file set
          // alone (we only fetch source/config). Treat as "npm" tool which
          // is accurate for npm/yarn/pnpm-less setups. Callers use this only
          // to label the tool, not to switch behavior.
          return { tool: "npm", roots: globs };
        }
      }
    } catch {
      // ignore malformed package.json
    }
  }

  // 3. turbo.json (standalone — workspaces not declared in root package.json)
  if (has("turbo.json")) {
    const turboText = read("turbo.json");
    let globs: string[] = [];
    if (turboText) {
      try {
        const turbo = JSON.parse(turboText) as Record<string, unknown>;
        // turbo 2.x: { extends?: string; pipeline: ... } (no workspace globs here)
        // workspaces live in package.json normally. Fall back to empty roots.
        if (Array.isArray(turbo.workspace)) globs = parseGlobs(turbo.workspace);
      } catch {
        // ignore
      }
    }
    return { tool: "turbo", roots: globs };
  }

  // 4. nx.json (standalone)
  if (has("nx.json")) {
    // nx implicitly uses the root package.json workspaces or its own
    // `implicitDependencies`. We don't parse the latter — empty roots is a
    // safe fallback that lets `moduleFor` degrade to first-level detection.
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

  // 6. Cargo.toml [workspace]
  const cargoPath = ["Cargo.toml", "cargo.toml"].find(has);
  if (cargoPath) {
    const text = read(cargoPath) ?? "";
    // Detect [workspace] section + members list
    let inWorkspace = false;
    const roots: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const sec = line.match(/^\s*\[(.+)\]\s*$/);
      if (sec) {
        inWorkspace = sec[1] === "workspace";
        continue;
      }
      if (!inWorkspace) continue;
      // members = ["pkg1", "pkg2"]
      const m = line.match(/^\s*members\s*=\s*(.+)$/);
      if (m) {
        const list = m[1].matchAll(/"([^"]+)"/g);
        let any = false;
        for (const mm of list) {
          any = true;
          roots.push(normalizeGlob(mm[1]));
        }
        if (!any) {
          // Single-line without quotes? e.g. members = ["pkg/*"]
          // Already handled by regex above; nothing else to do.
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

/**
 * Expand a workspace glob like `packages/*` against the file set.
 * Returns concrete root directory paths (e.g. `packages/ui`, `packages/core`).
 * Recursive globs (`libs/**`) are returned verbatim — `moduleFor` handles
 * them as prefix matches.
 */
function expandGlob(glob: string, allPaths: Iterable<string>): string[] {
  // Only `dir/*` (single-level) is expanded precisely.
  const star = glob.match(/^(.+?)\/\*$/);
  if (!star) return [glob]; // recursive or plain dir → keep as-is

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

/**
 * Build a list of concrete monorepo root directories (relative to repo
 * root) from the detected config + the file set. Used by `moduleFor` to
 * decide top-level modules.
 *
 * Order matters: more specific (longer) roots first so that `moduleFor`
 * can do prefix matching correctly.
 */
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
  // Longest-first so `packages/core` wins over `packages` if both present.
  return [...expanded].sort((a, b) => b.length - a.length);
}
