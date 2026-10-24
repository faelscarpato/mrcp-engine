import * as webTreeSitter from "web-tree-sitter";

export interface TreeSitterParser {
  parse: (sourceCode: string) => TreeSitterTree | null;
  setLanguage: (language: webTreeSitter.Language) => void;
}

export interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

export interface TreeSitterNode {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TreeSitterNode[];
  childCount: number;
  children: TreeSitterNode[];
  child: (index: number) => TreeSitterNode | null;
  field: (name: string) => TreeSitterNode | null;
}

export const LANGUAGE_WASM_MAP: Record<string, string> = {
  javascript: "/tree-sitter/tree-sitter-javascript.wasm",
  typescript: "/tree-sitter/tree-sitter-typescript.wasm",
  tsx: "/tree-sitter/tree-sitter-tsx.wasm",
  python: "/tree-sitter/tree-sitter-python.wasm",
  go: "/tree-sitter/tree-sitter-go.wasm",
  rust: "/tree-sitter/tree-sitter-rust.wasm",
  java: "/tree-sitter/tree-sitter-java.wasm",
  cpp: "/tree-sitter/tree-sitter-cpp.wasm",
  c: "/tree-sitter/tree-sitter-c.wasm",
  php: "/tree-sitter/tree-sitter-php.wasm",
  ruby: "/tree-sitter/tree-sitter-ruby.wasm",
  cobol: "/tree-sitter/tree-sitter-cobol.wasm",
  pascal: "/tree-sitter/tree-sitter-pascal.wasm",
  cds: "/tree-sitter/tree-sitter-sap_cds.wasm",
  sap_cds: "/tree-sitter/tree-sitter-sap_cds.wasm",
  abap: "/tree-sitter/tree-sitter-sap_abap.wasm",
  sap_abap: "/tree-sitter/tree-sitter-sap_abap.wasm",
  plsql: "/tree-sitter/tree-sitter-oracle_plsql.wasm",
  oracle_plsql: "/tree-sitter/tree-sitter-oracle_plsql.wasm",
  oracle: "/tree-sitter/tree-sitter-oracle_plsql.wasm",
  rpgle: "/tree-sitter/tree-sitter-rpgle.wasm",
  pine: "/tree-sitter/tree-sitter-pine.wasm",
  jcl: "/tree-sitter/tree-sitter-jcl.wasm",
  powerquery: "/tree-sitter/tree-sitter-powerquery_m.wasm",
  powerquery_m: "/tree-sitter/tree-sitter-powerquery_m.wasm",
  dax: "/tree-sitter/tree-sitter-dax.wasm",
  tsql: "/tree-sitter/tree-sitter-tsql.wasm",
  structured_text: "/tree-sitter/tree-sitter-structured_text.wasm",
  iec61131: "/tree-sitter/tree-sitter-structured_text.wasm",
  mql5: "/tree-sitter/tree-sitter-mql5.wasm",
  openedge_abl: "/tree-sitter/tree-sitter-openedge_abl.wasm",
  abl: "/tree-sitter/tree-sitter-openedge_abl.wasm",
  // Novos Wasms integrados
  c_sharp: "/tree-sitter/tree-sitter-c_sharp.wasm",
  cs: "/tree-sitter/tree-sitter-c_sharp.wasm",
  swift: "/tree-sitter/tree-sitter-swift.wasm",
  kotlin: "/tree-sitter/tree-sitter-kotlin.wasm",
  actionscript: "/tree-sitter/tree-sitter-actionscript.wasm",
  applescript: "/tree-sitter/tree-sitter-applescript.wasm",
  ahk: "/tree-sitter/tree-sitter-ahk.wasm",
  autoit: "/tree-sitter/tree-sitter-autoit.wasm",
  bicep: "/tree-sitter/tree-sitter-bicep.wasm",
  pipeline: "/tree-sitter/tree-sitter-pipeline.wasm",
  cfml: "/tree-sitter/tree-sitter-cfml.wasm",
  verse: "/tree-sitter/tree-sitter-verse.wasm",
  q: "/tree-sitter/tree-sitter-q.wasm",
  modelica: "/tree-sitter/tree-sitter-modelica.wasm",
  objectscript: "/tree-sitter/tree-sitter-objectscript.wasm",
  natural: "/tree-sitter/tree-sitter-natural.wasm",
  openscad: "/tree-sitter/tree-sitter-openscad.wasm",
  pawn: "/tree-sitter/tree-sitter-pawn.wasm",
  apex: "/tree-sitter/tree-sitter-apex.wasm",
  sas: "/tree-sitter/tree-sitter-sas.wasm",
  scl: "/tree-sitter/tree-sitter-scl.wasm",
  vba: "/tree-sitter/tree-sitter-vba.wasm",
  vhdl: "/tree-sitter/tree-sitter-vhdl.wasm",
  web3: "/tree-sitter/tree-sitter-web3.wasm",
  vyper: "/tree-sitter/tree-sitter-web3.wasm",
  move: "/tree-sitter/tree-sitter-web3.wasm",
};

export const EXTENSION_TO_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  py: "python",
  pyw: "python",
  go: "go",
  rs: "rust",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  hxx: "cpp",
  php: "php",
  phtml: "php",
  rb: "ruby",
  pas: "pascal",
  pp: "pascal",
  inc: "pascal",
  cobol: "cobol",
  cbl: "cobol",
  cpy: "cobol",
  cds: "cds",
  abap: "abap",
  clas: "abap",
  intf: "abap",
  prog: "abap",
  sql: "oracle_plsql",
  pls: "oracle_plsql",
  pks: "oracle_plsql",
  pkb: "oracle_plsql",
  pck: "oracle_plsql",
  plb: "oracle_plsql",
  trg: "oracle_plsql",
  fnc: "oracle_plsql",
  prc: "oracle_plsql",
  rpgle: "rpgle",
  rpg: "rpgle",
  sqlrpgle: "rpgle",
  pine: "pine",
  jcl: "jcl",
  job: "jcl",
  pq: "powerquery",
  dax: "dax",
  tsql: "tsql",
  st: "structured_text",
  scl: "structured_text",
  pou: "structured_text",
  exp: "structured_text",
  mq5: "mql5",
  mqh: "mql5",
  p: "openedge_abl",
  w: "openedge_abl",
  i: "openedge_abl",
  // C# & Swift & Kotlin
  cs: "c_sharp",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  // ActionScript
  as: "actionscript",
  mxml: "actionscript",
  // AppleScript
  applescript: "applescript",
  scpt: "applescript",
  scptd: "applescript",
  jxa: "applescript",
  // AutoHotkey
  ahk: "ahk",
  ah2: "ahk",
  // AutoIt
  au3: "autoit",
  // Bicep
  bicep: "bicep",
  bicepparam: "bicep",
  // Jenkinsfile / Pipeline
  jenkinsfile: "pipeline",
  // CFML
  cfm: "cfml",
  cfc: "cfml",
  cfs: "cfml",
  // Verse
  verse: "verse",
  // Q / KDB+
  q: "q",
  k: "q",
  // Modelica
  mo: "modelica",
  // ObjectScript
  mac: "objectscript",
  int: "objectscript",
  // Natural
  nsp: "natural",
  nsn: "natural",
  nss: "natural",
  nsa: "natural",
  nsg: "natural",
  nspda: "natural",
  nsl: "natural",
  nsc: "natural",
  nsf: "natural",
  // Pascal extras
  dpr: "pascal",
  dpk: "pascal",
  lpr: "pascal",
  // OpenSCAD
  scad: "openscad",
  // Pawn
  pwn: "pawn",
  sma: "pawn",
  // Apex
  cls: "apex",
  trigger: "apex",
  // SAS
  sas: "sas",
  sash: "sas",
  // Siemens SCL
  awl: "scl",
  udt: "scl",
  db: "scl",
  // VBA
  bas: "vba",
  frm: "vba",
  ctl: "vba",
  vbp: "vba",
  // VHDL
  vhd: "vhdl",
  vhdl: "vhdl",
  // Web3
  vy: "web3",
  move: "web3",
};

let parser: TreeSitterParser | null = null;
const loadedLanguages: Map<string, webTreeSitter.Language> = new Map();
let initialized = false;

export async function initTreeSitter(): Promise<void> {
  if (initialized) return;
  try {
    await webTreeSitter.Parser.init();
    parser = new webTreeSitter.Parser() as unknown as TreeSitterParser;
    initialized = true;
  } catch (error) {
    console.warn("Failed to initialize web-tree-sitter:", error);
  }
}

export function getParser(): TreeSitterParser | null {
  return parser;
}

export async function loadLanguage(
  languageName: string,
): Promise<webTreeSitter.Language | null> {
  if (loadedLanguages.has(languageName)) {
    return loadedLanguages.get(languageName)!;
  }

  const wasmPath = LANGUAGE_WASM_MAP[languageName];
  if (!wasmPath) {
    return null;
  }

  try {
    let wasmBytes: Uint8Array;

    if (
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.node
    ) {
      const fs = await import("fs");
      const path = await import("path");

      const cleanRelPath = wasmPath.startsWith("/")
        ? wasmPath.slice(1)
        : wasmPath;
      const possiblePaths = [
        path.join(process.cwd(), "public", cleanRelPath),
        path.join(process.cwd(), cleanRelPath),
        path.join(process.cwd(), "dist", cleanRelPath),
        path.resolve(process.cwd(), "..", "public", cleanRelPath),
        path.resolve(process.cwd(), "../..", "public", cleanRelPath),
        path.resolve(process.cwd(), "../../..", "public", cleanRelPath),
        path.resolve("/home/scarpatoweb/mrcp-engine/public", cleanRelPath),
      ];

      let foundPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }

      if (!foundPath) {
        console.warn(
          `[MRCP Tree-sitter] WASM file for ${languageName} not found in candidates.`,
        );
        return null;
      }

      wasmBytes = fs.readFileSync(foundPath);
    } else {
      const response = await fetch(wasmPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status}`);
      }
      wasmBytes = new Uint8Array(await response.arrayBuffer());
    }

    const language = await webTreeSitter.Language.load(wasmBytes);
    loadedLanguages.set(languageName, language);
    return language;
  } catch (error) {
    console.warn(
      `Failed to load tree-sitter language for ${languageName}:`,
      error,
    );
    return null;
  }
}
