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
  // RPGLE
  rpgle: "RPGLE",
  rpg: "RPGLE",
  sqlrpgle: "RPGLE",
  // Pine Script
  pine: "PineScript",
  // JCL
  jcl: "JCL",
  job: "JCL",
  // Power Query M
  pq: "PowerQuery",
  // DAX
  dax: "DAX",
  // T-SQL
  tsql: "TSQL",
  // Structured Text
  st: "StructuredText",
  scl: "StructuredText",
  pou: "StructuredText",
  exp: "StructuredText",
  // MQL5
  mq5: "MQL5",
  mqh: "MQL5",
  // OpenEdge ABL
  p: "OpenEdgeABL",
  w: "OpenEdgeABL",
  i: "OpenEdgeABL",
  // SAP ABAP & CDS
  abap: "ABAP",
  cds: "CDS",
  // ActionScript
  as: "ActionScript",
  mxml: "ActionScript",
  // AppleScript
  applescript: "AppleScript",
  scpt: "AppleScript",
  scptd: "AppleScript",
  jxa: "AppleScript",
  // AutoHotkey
  ahk: "AutoHotkey",
  ah2: "AutoHotkey",
  // AutoIt
  au3: "AutoIt",
  // Bicep
  bicep: "Bicep",
  bicepparam: "Bicep",
  // Jenkins / CI Pipeline
  jenkinsfile: "JenkinsPipeline",
  // CFML
  cfm: "CFML",
  cfc: "CFML",
  cfs: "CFML",
  // Verse
  verse: "Verse",
  // Q / KDB+
  q: "Q",
  k: "Q",
  // Kotlin Script
  kts: "Kotlin",
  // Modelica
  mo: "Modelica",
  // InterSystems ObjectScript
  mac: "ObjectScript",
  int: "ObjectScript",
  // Software AG Natural
  nsp: "Natural",
  nsn: "Natural",
  nss: "Natural",
  nsa: "Natural",
  nsg: "Natural",
  nspda: "Natural",
  nsl: "Natural",
  nsc: "Natural",
  nsf: "Natural",
  // Pascal extras
  dpr: "Pascal",
  dpk: "Pascal",
  lpr: "Pascal",
  // OpenSCAD
  scad: "OpenSCAD",
  // Pawn
  pwn: "Pawn",
  sma: "Pawn",
  // Salesforce Apex
  cls: "Apex",
  trigger: "Apex",
  // SAS
  sas: "SAS",
  sash: "SAS",
  // Siemens SCL / STEP 7
  awl: "SCL",
  udt: "SCL",
  db: "SCL",
  // Visual Basic for Applications (VBA)
  bas: "VBA",
  frm: "VBA",
  ctl: "VBA",
  vbp: "VBA",
  // VHDL
  vhd: "VHDL",
  vhdl: "VHDL",
  // Web3 (Vyper & Move)
  vy: "Vyper",
  move: "Move",
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
  "rpgle",
  "rpg",
  "sqlrpgle",
  "pine",
  "jcl",
  "job",
  "pq",
  "dax",
  "tsql",
  "st",
  "scl",
  "pou",
  "exp",
  "mq5",
  "mqh",
  "p",
  "w",
  "i",
  "abap",
  "cds",
  // ActionScript
  "as",
  "mxml",
  // AppleScript
  "applescript",
  "scpt",
  "scptd",
  "jxa",
  // AutoHotkey
  "ahk",
  "ah2",
  // AutoIt
  "au3",
  // Bicep
  "bicep",
  "bicepparam",
  // Pipeline
  "jenkinsfile",
  // CFML
  "cfm",
  "cfc",
  "cfs",
  // Verse
  "verse",
  // Q
  "q",
  "k",
  "kts",
  // Modelica
  "mo",
  // ObjectScript
  "mac",
  "int",
  // Natural
  "nsp",
  "nsn",
  "nss",
  "nsa",
  "nsg",
  "nspda",
  "nsl",
  "nsc",
  "nsf",
  // Pascal extras
  "dpr",
  "dpk",
  "lpr",
  // OpenSCAD
  "scad",
  // Pawn
  "pwn",
  "sma",
  // Apex
  "cls",
  "trigger",
  // SAS
  "sas",
  "sash",
  // SCL
  "awl",
  "udt",
  "db",
  // VBA
  "bas",
  "frm",
  "ctl",
  "vbp",
  // VHDL
  "vhd",
  "vhdl",
  // Web3
  "vy",
  "move",
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
