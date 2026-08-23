// Tree-sitter based AST extraction using web-tree-sitter
// This provides accurate AST-based function, call, and import extraction for multiple languages

import type { ExtractedFunction } from "./functions.js";
import type { ImportRef } from "./imports.js";

/**
 * A detected call expression: caller → callee.
 * `callerFile` is the file where the call appears;
 * `calleeName` is the identifier being called;
 * `isMethodCall` is true for `x.method()` patterns.
 */
export interface CallExpression {
  calleeName: string;
  callerLine: number;
  isMethodCall: boolean;
}

// Import web-tree-sitter
import * as webTreeSitter from "web-tree-sitter";

// Tree-sitter parser types
interface TreeSitterParser {
  parse: (sourceCode: string) => TreeSitterTree | null;
  setLanguage: (language: webTreeSitter.Language) => void;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

interface TreeSitterNode {
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

// Language to WASM file mapping
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

// Extension to Language mapping
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

// Function node types by language
const FUNCTION_NODE_TYPES: Record<string, string[]> = {
  javascript: [
    "function_declaration",
    "method_definition",
    "arrow_function",
    "function_expression",
    "generator_function_declaration",
  ],
  typescript: [
    "function_declaration",
    "method_definition",
    "arrow_function",
    "function_expression",
    "generator_function_declaration",
  ],
  tsx: [
    "function_declaration",
    "method_definition",
    "arrow_function",
    "function_expression",
    "generator_function_declaration",
  ],
  python: ["function_definition", "async_function_definition"],
  go: ["function_declaration", "method_declaration"],
  rust: ["function_item", "method_item"],
  java: ["method_declaration", "constructor_declaration"],
  cpp: ["function_definition", "function_declaration", "method_definition"],
  c: ["function_definition", "function_declaration"],
  php: ["function_definition", "method_declaration"],
  ruby: ["method", "def", "defs", "defp"],
  cobol: ["paragraph", "section"],
  pascal: ["function_declaration", "procedure_declaration"],
  cds: ["view_entity_definition", "view_definition"],
  sap_cds: ["view_entity_definition", "view_definition"],
  abap: ["method_implementation", "method_definition_item", "report_statement"],
  sap_abap: ["method_implementation", "method_definition_item", "report_statement"],
  plsql: [
    "package_definition",
    "package_body_definition",
    "procedure_definition",
    "function_definition",
    "trigger_definition",
    "anonymous_block",
  ],
  oracle_plsql: [
    "package_definition",
    "package_body_definition",
    "procedure_definition",
    "function_definition",
    "trigger_definition",
    "anonymous_block",
  ],
};

let parser: TreeSitterParser | null = null;
const loadedLanguages: Map<string, webTreeSitter.Language> = new Map();
let initialized = false;

/**
 * Initialize web-tree-sitter
 */
async function initTreeSitter(): Promise<void> {
  if (initialized) return;

  try {
    await webTreeSitter.Parser.init();
    parser = new webTreeSitter.Parser() as unknown as TreeSitterParser;
    initialized = true;
  } catch (error) {
    console.warn("Failed to initialize web-tree-sitter:", error);
  }
}

/**
 * Load a language from WASM file with resilient cascading path resolution
 */
async function loadLanguage(
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

    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      const fs = await import("fs");
      const path = await import("path");

      const cleanRelPath = wasmPath.startsWith("/") ? wasmPath.slice(1) : wasmPath;
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
        console.warn(`[MRCP Tree-sitter] WASM file for ${languageName} not found in candidates: ${possiblePaths.join(", ")}`);
        return null;
      }

      wasmBytes = fs.readFileSync(foundPath);
    } else {
      // Browser env fallback
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
    console.warn(`Failed to load language ${languageName}:`, error);
    return null;
  }
}

/**
 * Extract functions from code using Tree-sitter
 */
export async function extractFunctionsWithTreeSitter(
  path: string,
  content: string,
  language: string,
): Promise<ExtractedFunction[]> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();
  const treeSitterLang = EXTENSION_TO_LANGUAGE_MAP[ext] || language.toLowerCase();
  const nodeTypes = FUNCTION_NODE_TYPES[treeSitterLang];

  if (!nodeTypes || nodeTypes.length === 0) {
    return [];
  }

  await initTreeSitter();
  if (!parser) return [];

  const loadedLanguage = await loadLanguage(treeSitterLang);
  if (!loadedLanguage) return [];

  try {
    parser.setLanguage(loadedLanguage);
    const tree = parser.parse(content);
    if (!tree) return [];
    const rootNode = tree.rootNode;

    const functions: ExtractedFunction[] = [];

    function visit(node: TreeSitterNode, parentClassName?: string) {
      if (nodeTypes.includes(node.type)) {
        let name = "";
        let params: string[] = [];
        let isMethod = false;

        const nameNode = node.namedChildren.find(
          (child) =>
            child.type === "identifier" ||
            child.type === "property_identifier" ||
            child.type === "qualified_identifier" ||
            child.type === "type_identifier",
        );
        if (nameNode) {
          name = nameNode.text;
        }

        const paramsNode = node.namedChildren.find(
          (child) =>
            child.type === "formal_parameters" || child.type === "parameters",
        );
        if (paramsNode) {
          params = paramsNode.namedChildren
            .filter(
              (child) =>
                child.type === "identifier" || child.type === "parameter",
            )
            .map((child) => child.text);
        }

        if (parentClassName) {
          isMethod = true;
        }

        let currentClass = parentClassName;
        if (node.type === "class_declaration" || node.type === "class") {
          const classNameNode = node.namedChildren.find(
            (child) =>
              child.type === "identifier" || child.type === "type_identifier",
          );
          if (classNameNode) {
            currentClass = classNameNode.text;
          }
        }

        const before = content.substring(0, node.startIndex);
        const lineNumber = before.split("\n").length;

        if (name) {
          functions.push({
            name,
            path,
            line: lineNumber,
            language:
              treeSitterLang.charAt(0).toUpperCase() + treeSitterLang.slice(1),
            parameters: params,
            isMethod,
            className: currentClass,
          });
        }

        for (const child of node.namedChildren) {
          visit(child, currentClass);
        }
      } else {
        let currentClass = parentClassName;
        if (node.type === "class_declaration" || node.type === "class") {
          const classNameNode = node.namedChildren.find(
            (child) =>
              child.type === "identifier" || child.type === "type_identifier",
          );
          if (classNameNode) {
            currentClass = classNameNode.text;
          }
        }
        for (const child of node.namedChildren) {
          visit(child, currentClass);
        }
      }
    }

    visit(rootNode);

    const seen = new Set<string>();
    return functions.filter((f) => {
      const key = `${f.path}:${f.line}:${f.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error(`Failed to parse ${path} with Tree-sitter:`, error);
    return [];
  }
}

/**
 * Check if Tree-sitter is available for a language
 */
export function isTreeSitterAvailable(language: string): boolean {
  const ext = language.toLowerCase();
  return Object.keys(LANGUAGE_WASM_MAP).includes(ext) || Object.keys(EXTENSION_TO_LANGUAGE_MAP).includes(ext);
}

/**
 * Get Tree-sitter node types for function definitions by language
 */
export function getFunctionNodeTypes(language: string): string[] {
  return FUNCTION_NODE_TYPES[language.toLowerCase()] || [];
}

// ---------------------------------------------------------------------------
// Call expression extraction via Tree-sitter
// ---------------------------------------------------------------------------

const CALL_NODE_TYPES: Record<string, string[]> = {
  javascript: ["call_expression"],
  typescript: ["call_expression"],
  tsx: ["call_expression"],
  python: ["call", "call_expression"],
  go: ["call_expression"],
  rust: ["call_expression"],
  java: ["method_invocation", "constructor_invocation"],
  cpp: ["call_expression"],
  c: ["call_expression"],
  php: ["function_call_expression", "method_call_expression", "scoped_call_expression"],
  ruby: ["call", "method_call"],
  cobol: ["perform_statement", "call_statement"],
  pascal: ["procedure_statement", "function_designator"],
  cds: ["select_statement"],
  abap: ["method_call_statement", "call_method_statement", "perform_statement"],
  plsql: ["function_call", "procedure_call", "call_statement"],
  oracle_plsql: ["function_call", "procedure_call", "call_statement"],
};

const CALL_KEYWORDS = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "return", "new", "delete",
  "typeof", "instanceof", "void", "throw", "try", "catch", "finally", "with", "var",
  "let", "const", "function", "class", "import", "export", "from", "as", "default",
  "break", "continue", "debugger", "super", "this", "null", "true", "false",
  "undefined", "NaN", "Infinity", "eval",
]);

function getField(node: any, fieldName: string): any {
  if (!node) return null;
  if (typeof node.childForFieldName === "function") {
    return node.childForFieldName(fieldName);
  }
  if (typeof node.field === "function") {
    return node.field(fieldName);
  }
  return null;
}

function extractCallFromNode(
  node: TreeSitterNode,
): { name: string; isMethod: boolean } | null {
  if (node.type === "call_expression" || node.type === "call") {
    const fn = getField(node, "function") ?? node.namedChildren?.[0];
    if (!fn) return null;

    if (fn.type === "identifier") {
      const name = fn.text;
      if (CALL_KEYWORDS.has(name)) return null;
      return { name, isMethod: false };
    }

    if (
      fn.type === "member_expression" ||
      fn.type === "member_access" ||
      fn.type === "field_expression" ||
      fn.type === "selector_expression"
    ) {
      const prop = getField(fn, "property") ?? getField(fn, "field") ?? fn.namedChildren?.[1];
      if (prop && (prop.type === "identifier" || prop.type === "property_identifier" || prop.type === "field_identifier")) {
        const name = prop.text;
        if (CALL_KEYWORDS.has(name)) return null;
        return { name, isMethod: true };
      }
    }
  }

  if (node.type === "method_invocation") {
    const nameNode = getField(node, "name") ?? node.namedChildren.find((c) => c.type === "identifier");
    if (nameNode) {
      return { name: nameNode.text, isMethod: true };
    }
  }

  if (
    node.type === "perform_statement" ||
    node.type === "call_statement" ||
    node.type === "method_call_statement" ||
    node.type === "procedure_call"
  ) {
    const nameNode = node.namedChildren.find(
      (c) => c.type === "identifier" || c.type === "qualified_identifier",
    );
    if (nameNode) {
      return { name: nameNode.text, isMethod: node.type.includes("method") };
    }
  }

  return null;
}

function collectCallExpressions(
  root: TreeSitterNode,
  supportedTypes: string[],
): CallExpression[] {
  const out: CallExpression[] = [];
  const visit = (node: TreeSitterNode) => {
    if (supportedTypes.includes(node.type)) {
      const extracted = extractCallFromNode(node);
      if (extracted) {
        out.push({
          calleeName: extracted.name,
          callerLine: node.startPosition.row + 1,
          isMethodCall: extracted.isMethod,
        });
      }
    }
    for (const child of node.namedChildren ?? []) {
      visit(child);
    }
  };
  visit(root);
  return out;
}

export async function extractCallsWithTreeSitter(
  path: string,
  content: string,
  language: string,
): Promise<CallExpression[]> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();
  const treeSitterLang = EXTENSION_TO_LANGUAGE_MAP[ext] || language.toLowerCase();
  const nodeTypes = CALL_NODE_TYPES[treeSitterLang];
  if (!nodeTypes || nodeTypes.length === 0) return [];

  await initTreeSitter();
  if (!parser) return [];

  const loadedLanguage = await loadLanguage(treeSitterLang);
  if (!loadedLanguage) return [];

  try {
    parser.setLanguage(loadedLanguage);
    const tree = parser.parse(content);
    if (!tree) return [];
    return collectCallExpressions(tree.rootNode, nodeTypes);
  } catch (error) {
    console.error(`Failed to extract calls from ${path} with Tree-sitter:`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Import resolution via Tree-sitter
// ---------------------------------------------------------------------------

export interface TreeSitterImportResult {
  imports: ImportRef[];
}

const IMPORT_NODE_TYPES: Record<string, string[]> = {
  javascript: ["import_statement", "export_statement"],
  typescript: ["import_statement", "export_statement"],
  tsx: ["import_statement", "export_statement"],
  python: ["import_statement", "import_from_statement", "import_from"],
  go: ["import_declaration", "import_spec"],
  rust: ["use_declaration"],
  java: ["import_declaration"],
  cpp: ["preproc_include"],
  c: ["preproc_include"],
  php: ["include_expression", "require_expression", "namespace_use_declaration"],
  ruby: ["require", "require_relative", "load"],
  cobol: ["copy_statement"],
  pascal: ["uses_clause"],
  cds: ["using_statement"],
  abap: ["include_statement", "tables_statement", "type_pools_statement"],
  plsql: ["package_specification", "package_body_definition"],
  oracle_plsql: ["package_specification", "package_body_definition"],
};

function collectStrings(node: TreeSitterNode, maxDepth = 3): string[] {
  const out: string[] = [];
  const seen = new Set<number>();
  const walk = (n: TreeSitterNode, depth: number) => {
    if (depth > maxDepth) return;
    if (
      n.type === "string" ||
      n.type === "string_literal" ||
      n.type === "raw_string_literal"
    ) {
      if (!seen.has(n.startIndex)) {
        seen.add(n.startIndex);
        const t = n.text;
        const stripped = t.match(/^["'`]+|["'`]+$/g) ? t.slice(1, -1) : t;
        if (stripped) out.push(stripped);
      }
      return;
    }
    for (const c of n.children ?? []) walk(c, depth + 1);
  };
  walk(node, 0);
  return out;
}

function findSourceField(node: TreeSitterNode): string | null {
  const src = getField(node, "source");
  if (!src) return null;
  const t = src.text;
  return t.match(/^["'`]/) ? t.slice(1, -1) : t;
}

function isDynamicImport(node: TreeSitterNode): string | null {
  if (node.type !== "call_expression") return null;
  const fn = getField(node, "function");
  if (!fn) return null;
  const firstArg = getField(node, "arguments");
  if (!firstArg) return null;
  if (fn.type === "import") {
    for (const c of firstArg.children ?? []) {
      if (
        c.type === "string" ||
        c.type === "string_literal" ||
        c.type === "template_string"
      ) {
        const t = c.text;
        return t.match(/^["'`]/) ? t.slice(1, -1) : t;
      }
    }
  }
  return null;
}

function isRelativeSpec(s: string): boolean {
  return s.startsWith("./") || s.startsWith("../") || s.startsWith("/");
}

export async function extractImportsWithTreeSitter(
  path: string,
  content: string,
  language: string,
): Promise<TreeSitterImportResult> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();
  const treeSitterLang = EXTENSION_TO_LANGUAGE_MAP[ext] || language.toLowerCase();
  const nodeTypes = IMPORT_NODE_TYPES[treeSitterLang];

  if (!nodeTypes || nodeTypes.length === 0) {
    return { imports: [] };
  }

  await initTreeSitter();
  if (!parser) return { imports: [] };

  const loadedLanguage = await loadLanguage(treeSitterLang);
  if (!loadedLanguage) return { imports: [] };

  try {
    parser.setLanguage(loadedLanguage);
    const tree = parser.parse(content);
    if (!tree) return { imports: [] };

    const out: ImportRef[] = [];
    const seen = new Set<string>();

    const push = (spec: string) => {
      const key = spec.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ raw: key, isRelative: isRelativeSpec(key) });
    };

    function visit(node: TreeSitterNode) {
      if (
        treeSitterLang === "javascript" ||
        treeSitterLang === "typescript" ||
        treeSitterLang === "tsx"
      ) {
        if (
          node.type === "import_statement" ||
          node.type === "export_statement"
        ) {
          const src = findSourceField(node);
          if (src) push(src);
          return;
        }
        const dyn = isDynamicImport(node);
        if (dyn) {
          push(dyn);
          return;
        }
        if (node.type === "call_expression") {
          const fn = getField(node, "function");
          if (fn && fn.type === "identifier" && fn.text === "require") {
            const args = getField(node, "arguments");
            const strs = args ? collectStrings(args, 1) : [];
            for (const s of strs) push(s);
            return;
          }
        }
      }

      if (treeSitterLang === "python") {
        if (node.type === "import_from_statement" || node.type === "import_from") {
          const mod = getField(node, "module_name") ?? getField(node, "module") ?? node.namedChildren?.[0];
          if (mod) push(mod.text);
          return;
        }
        if (node.type === "import_statement") {
          for (const c of node.namedChildren ?? []) {
            if (c.type === "dotted_name" || c.type === "identifier") push(c.text);
          }
          return;
        }
      }

      if (treeSitterLang === "go") {
        if (node.type === "import_spec" || node.type === "import_declaration") {
          const strs = collectStrings(node, 2);
          for (const s of strs) push(s);
          return;
        }
      }

      if (treeSitterLang === "rust") {
        if (node.type === "use_declaration") {
          const t = node.text.replace(/^use\s+/, "").replace(/;$/, "");
          const first = t.split("::")[0];
          if (first) push(first);
          return;
        }
      }

      if (treeSitterLang === "java") {
        if (node.type === "import_declaration") {
          const t = node.text.replace(/^import\s+(static\s+)?/, "").replace(/;$/, "").trim();
          if (t) push(t);
          return;
        }
      }

      if (treeSitterLang === "c" || treeSitterLang === "cpp") {
        if (node.type === "preproc_include") {
          const pathChild = node.namedChildren?.[0];
          const t = pathChild ? pathChild.text.replace(/^[<"']|[> "']$/g, "") : node.text.replace(/^#include\s+/, "").replace(/[<"'>]/g, "").trim();
          if (t) push(t);
          return;
        }
      }

      if (treeSitterLang === "abap") {
        if (node.type === "include_statement" || node.type === "tables_statement") {
          const nameChild = node.namedChildren.find((c) => c.type === "identifier");
          if (nameChild) push(nameChild.text);
          return;
        }
      }

      for (const c of node.namedChildren ?? []) visit(c);
    }

    visit(tree.rootNode);
    return { imports: out };
  } catch (error) {
    console.error(`Failed to extract imports from ${path} with Tree-sitter:`, error);
    return { imports: [] };
  }
}
