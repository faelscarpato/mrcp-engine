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
