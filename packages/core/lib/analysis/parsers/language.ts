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

export const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".cache",
  ".vercel",
  ".git",
  ".gemini",
  "coverage",
  ".nuget",
  "vendor",
  "obj",
  ".output",
  "temp",
  "tmp",
]);

export function isIgnoredPath(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments.some((segment) =>
    IGNORED_DIRECTORIES.has(segment.toLowerCase()),
  );
}

export function detectLanguage(path: string): string | undefined {
  if (isIgnoredPath(path)) return undefined;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? EXT_LANG[ext] : undefined;
}

export function isSourceFile(path: string): boolean {
  if (isIgnoredPath(path)) return false;
  const ext = path.split(".").pop()?.toLowerCase();
  return !!ext && SOURCE_EXTS.has(ext);
}

export function isConfigFile(path: string): boolean {
  if (isIgnoredPath(path)) return false;
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

export {
  detectMonorepoConfig,
  resolveMonorepoRoots,
} from "./monorepo-detector.js";
