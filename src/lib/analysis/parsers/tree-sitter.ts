// Tree-sitter based function extraction using web-tree-sitter
// This provides accurate AST-based function extraction for multiple languages

import type { ExtractedFunction } from "./functions";
import type { ImportRef } from "./imports";

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
const LANGUAGE_WASM_MAP: Record<string, string> = {
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
    // web-tree-sitter's Parser type is structurally incompatible with our
    // TreeSitterParser interface in some TypeScript configurations. Cast to
    // unknown first to satisfy the compiler, preserving runtime behavior.
    parser = new webTreeSitter.Parser() as unknown as TreeSitterParser;
    initialized = true;
  } catch (error) {
    console.warn("Failed to initialize web-tree-sitter:", error);
  }
}

/**
 * Load a language from WASM file
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
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status}`);
    }
    const wasmBytes = new Uint8Array(await response.arrayBuffer());
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

  // Map extension to language
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    php: "php",
    rb: "ruby",
  };

  const treeSitterLang = langMap[ext] || language.toLowerCase();
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

    // Traverse the AST to find function nodes
    function visit(node: TreeSitterNode, parentClassName?: string) {
      if (nodeTypes.includes(node.type)) {
        // Extract function name
        let name = "";
        let params: string[] = [];
        let isMethod = false;

        // Find the name node
        const nameNode = node.namedChildren.find(
          (child) =>
            child.type === "identifier" || child.type === "property_identifier",
        );
        if (nameNode) {
          name = nameNode.text;
        }

        // Find parameters
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

        // Check if it's a method (inside a class)
        if (parentClassName) {
          isMethod = true;
        }

        // Check for class context
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

        // Calculate line number
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

        // Recursively visit children
        for (const child of node.namedChildren) {
          visit(child, currentClass);
        }
      } else {
        // For class nodes, pass class name to children
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

    // Deduplicate by name + line
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
  return Object.keys(LANGUAGE_WASM_MAP).includes(ext);
}

/**
 * Get Tree-sitter node types for function definitions by language
 */
export function getFunctionNodeTypes(language: string): string[] {
  return FUNCTION_NODE_TYPES[language.toLowerCase()] || [];
}

// ---------------------------------------------------------------------------
// Call expression extraction via Tree-sitter (Sprint 4, task 2.6)
// ---------------------------------------------------------------------------

// Node types that represent function calls per language family
const CALL_NODE_TYPES: Record<string, string[]> = {
  javascript: ["call_expression"],
  typescript: ["call_expression"],
  tsx: ["call_expression"],
  python: ["call", "call_expression"],
};

// Keywords to skip when scanning call expressions (built-in / control flow)
const CALL_KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "void",
  "throw",
  "try",
  "catch",
  "finally",
  "with",
  "var",
  "let",
  "const",
  "function",
  "class",
  "import",
  "export",
  "from",
  "as",
  "default",
  "break",
  "continue",
  "debugger",
  "super",
  "this",
  "null",
  "true",
  "false",
  "undefined",
  "NaN",
  "Infinity",
  "eval",
]);

/**
 * Check if a node represents a call expression and extract callee info.
 * Returns null if the node is not a relevant call expression.
 */
function extractCallFromNode(
  node: TreeSitterNode,
): { name: string; isMethod: boolean } | null {
  // JS/TS/Python: call_expression — function child is the callee
  if (node.type === "call_expression") {
    const fn = node.field("function") ?? node.namedChildren[0];
    if (!fn) return null;

    // Simple identifier: foo()
    if (fn.type === "identifier") {
      const name = fn.text;
      if (CALL_KEYWORDS.has(name)) return null;
      return { name, isMethod: false };
    }

    // Member expression: obj.foo() or this.foo()
    if (fn.type === "member_expression" || fn.type === "member_access") {
      const prop = fn.field("property") ?? fn.namedChildren[1];
      if (
        prop &&
        (prop.type === "identifier" || prop.type === "property_identifier")
      ) {
        const name = prop.text;
        if (CALL_KEYWORDS.has(name)) return null;
        return { name, isMethod: true };
      }
    }
  }
  return null;
}

/**
 * Walk a Tree-sitter AST and collect all call expressions.
 */
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

/**
 * Extract call expressions from source code using Tree-sitter AST.
 * More precise than regex: avoids false positives inside strings, comments,
 * and non-call parenthesized expressions.
 *
 * Returns an empty array on any failure (WASM not loaded, unsupported
 * language, parse error) — the regex fallback then takes over.
 */
export async function extractCallsWithTreeSitter(
  path: string,
  content: string,
  language: string,
): Promise<CallExpression[]> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "javascript",
    py: "python",
  };
  const treeSitterLang = langMap[ext] || language.toLowerCase();
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
    console.error(
      `Failed to extract calls from ${path} with Tree-sitter:`,
      error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Import resolution via Tree-sitter (Sprint 3, task 2.4)
// ---------------------------------------------------------------------------

/**
 * Result of AST-based import extraction. Same shape as regex `ImportRef`,
 * plus the set of module specifiers seen (kept here so the caller can
 * extract unique aliases without re-walking the AST).
 */
export interface TreeSitterImportResult {
  imports: ImportRef[];
}

// Node types that carry module specifiers, per language family. The string
// literal holding the path is always a child of one of these.
const IMPORT_NODE_TYPES: Record<string, string[]> = {
  javascript: ["import_statement", "export_statement"],
  typescript: ["import_statement", "export_statement"],
  tsx: ["import_statement", "export_statement"],
  // `import_from` is the python import statement node in tree-sitter-python
  python: ["import_statement", "import_from"],
  // tree-sitter-go uses `import_declaration` (block) and individual
  // `import_spec` children; we handle both by scanning for string nodes.
  go: ["import_declaration", "import_spec"],
  // tree-sitter-rust uses `use_declaration`
  rust: ["use_declaration"],
};

/**
 * Collect every string literal child of `node` (depth-bounded). Returns
 * unique texts in document order.
 */
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
        // Strip surrounding quotes/backticks
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

/**
 * Find the `source` field of an import/export statement (JS/TS). Returns the
 * string literal text without quotes, or null.
 */
function findSourceField(node: TreeSitterNode): string | null {
  const src = node.field("source");
  if (!src) return null;
  // src is a string node; strip quotes
  const t = src.text;
  return t.match(/^["'`]/) ? t.slice(1, -1) : t;
}

/**
 * Detect a dynamic `import("...")` call expression. Tree-sitter represents
 * this as `call_expression` whose `function` child is an `import` identifier.
 */
function isDynamicImport(node: TreeSitterNode): string | null {
  if (node.type !== "call_expression") return null;
  const fn = node.field("function");
  if (!fn) return null;
  const firstArg = node.field("arguments");
  if (!firstArg) return null;
  // `import(...)`: the function node is the keyword `import`.
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

/**
 * Heuristic: a specifier is relative when it starts with `./`, `../`, or `/`.
 * TypeScript path-aliases (`@/`, `~`, `#`) are NOT marked relative here —
 * they're resolved by the regex fallback that reads `tsconfig.json` (task 2.5).
 */
function isRelativeSpec(s: string): boolean {
  return s.startsWith("./") || s.startsWith("../") || s.startsWith("/");
}

/**
 * Extract imports from a source file using Tree-sitter. More precise than the
 * regex fallback: catches dynamic `import("./x")`, re-exports
 * (`export * from "./y"`, `export {a} from "./z"`), and TS `import type`
 * without false-positives from strings that merely match the regex in a
 * comment or string literal.
 *
 * On any failure (WASM not loaded, unsupported language, parse error) returns
 * an empty array — the regex fallback in `imports.ts` then takes over.
 */
export async function extractImportsWithTreeSitter(
  path: string,
  content: string,
  language: string,
): Promise<TreeSitterImportResult> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();

  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
  };
  const treeSitterLang = langMap[ext] || language.toLowerCase();
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
      const key = spec;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ raw: spec, isRelative: isRelativeSpec(spec) });
    };

    function visit(node: TreeSitterNode) {
      // JS/TS: import_statement / export_statement carry a `source` field
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
          // Don't recurse — children of these statements are bindings, not
          // further imports.
          return;
        }
        // Dynamic import("./x")
        const dyn = isDynamicImport(node);
        if (dyn) {
          push(dyn);
          return;
        }
        // require("...") — common JS
        if (node.type === "call_expression") {
          const fn = node.field("function");
          if (fn && fn.type === "identifier" && fn.text === "require") {
            const args = node.field("arguments");
            const strs = args ? collectStrings(args, 1) : [];
            for (const s of strs) push(s);
            return;
          }
        }
      }

      // Python: import_from has a module field; import_statement carries a
      // dotted name in its children.
      if (treeSitterLang === "python") {
        if (node.type === "import_from") {
          const mod = node.field("module");
          if (mod) push(mod.text);
          return;
        }
        if (node.type === "import_statement") {
          // children are dotted_name nodes; their text is the module path
          for (const c of node.namedChildren ?? []) {
            if (c.type === "dotted_name") push(c.text);
          }
          return;
        }
      }

      // Go: import_declaration block ("...") or single import_spec "..."
      if (treeSitterLang === "go") {
        if (node.type === "import_spec") {
          const strs = collectStrings(node, 1);
          for (const s of strs) push(s);
          return;
        }
        if (node.type === "import_declaration") {
          for (const c of node.namedChildren ?? []) {
            if (c.type === "import_spec") {
              const strs = collectStrings(c, 1);
              for (const s of strs) push(s);
            }
          }
          return;
        }
      }

      // Rust: use_declaration -> argument_list or direct path
      if (treeSitterLang === "rust") {
        if (node.type === "use_declaration") {
          // text is like `use std::collections::HashMap;` — take the first
          // path segment only as the "module" (crate or `crate::`).
          const t = node.text.replace(/^use\s+/, "").replace(/;$/, "");
          const first = t.split("::")[0];
          if (first) push(first);
          return;
        }
      }

      for (const c of node.namedChildren ?? []) visit(c);
    }

    visit(tree.rootNode);
    return { imports: out };
  } catch (error) {
    console.error(
      `Failed to extract imports from ${path} with Tree-sitter:`,
      error,
    );
    return { imports: [] };
  }
}
