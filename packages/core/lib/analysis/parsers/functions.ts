// Function extraction using regex patterns and Tree-sitter (when available)
// This provides function detection for multiple languages

import type { GraphNode, GraphEdge } from "@/lib/graph-types";
import {
  extractFunctionsWithTreeSitter,
  extractCallsWithTreeSitter,
  isTreeSitterAvailable,
} from "./tree-sitter.js";

export interface ExtractedFunction {
  name: string;
  path: string;
  line: number;
  language: string;
  parameters?: string[];
  isMethod?: boolean;
  className?: string; // For class methods
}

// Regex patterns for function detection in various languages
const FUNCTION_PATTERNS: Record<
  string,
  Array<{
    regex: RegExp;
    extract: (match: RegExpMatchArray) => ExtractedFunction | null;
  }>
> = {
  // TypeScript/JavaScript
  ts: [
    // Function declaration: function name(params) {}
    {
      regex: /function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // Arrow function: const name = (params) => {}
    {
      regex: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // Class method: methodName(params) {}
    {
      regex: /([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{(?:\s*\/\/|\s*\/\*|\s*\*)?/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // ES6 class method: methodName(params) {}
    {
      regex: /([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],
  js: [
    // Same as TypeScript
    {
      regex: /function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "JavaScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    {
      regex: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "JavaScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],

  // Python
  py: [
    // def function_name(params):
    {
      regex: /def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*:/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Python",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // Class method: def method_name(self, params):
    {
      regex: /def\s+([a-zA-Z_][\w]*)\s*\(self[^)]*\)\s*:/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Python",
        parameters: [],
        isMethod: true,
      }),
    },
    // Async def
    {
      regex: /async\s+def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*:/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Python",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],

  // Go
  go: [
    // func functionName(params) returnType {
    {
      regex: /func\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*[^{]*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Go",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // Method: func (r Receiver) methodName(params) {
    {
      regex: /func\s*\([^)]+\)\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*[^{]*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Go",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: true,
      }),
    },
  ],

  // Rust
  rs: [
    // fn function_name(params) -> ReturnType {
    {
      regex: /fn\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Rust",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // impl Block methods
    {
      regex: /fn\s+([a-zA-Z_][\w]*)\s*\((&?[^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Rust",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: true,
      }),
    },
  ],

  // Java
  java: [
    // public/private/protected returnType functionName(params) {
    {
      regex:
        /(?:public|private|protected|static|final|native|synchronized|\s)\s*[\w<>[]\s]+\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Java",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],

  // C/C++
  c: [
    // returnType functionName(params) {
    {
      regex: /[\w\s*]+\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "C",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],
  cpp: [
    // Same as C but with more keywords
    {
      regex:
        /(?:[\w:\s<>]+\s+)+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:const)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "C++",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],

  // PHP
  php: [
    // function functionName($params) {
    {
      regex: /function\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "PHP",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
    // Class method: public function methodName($params) {
    {
      regex:
        /(?:public|private|protected|static|final|abstract|\s)\s+function\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "PHP",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: true,
      }),
    },
  ],

  // Ruby
  rb: [
    // def function_name(params)
    {
      regex: /def\s+([a-zA-Z_][\w?]*)\s*\(?([^)]*)\)?/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Ruby",
        parameters: m[2]
          ? m[2]
              .split(",")
              .map((p) => p.trim())
              .filter((p) => p)
          : [],
        isMethod: false,
      }),
    },
  ],

  // Swift
  swift: [
    // func functionName(params) -> ReturnType {
    {
      regex: /func\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Swift",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],

  // Kotlin
  kt: [
    // fun functionName(params): ReturnType {
    {
      regex: /fun\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Kotlin",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],

  // Scala
  scala: [
    // def functionName(params): ReturnType = {
    {
      regex: /def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Scala",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p),
        isMethod: false,
      }),
    },
  ],
};

/**
 * Extract functions from source code using Tree-sitter (preferred) or regex patterns (fallback)
 */
export async function extractFunctionsFromCode(
  path: string,
  content: string,
  language: string,
): Promise<ExtractedFunction[]> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();

  // Try Tree-sitter first if available
  if (isTreeSitterAvailable(ext) || isTreeSitterAvailable(language)) {
    try {
      const treeSitterFunctions = await extractFunctionsWithTreeSitter(
        path,
        content,
        ext,
      );
      if (treeSitterFunctions.length > 0) {
        return treeSitterFunctions;
      }
    } catch (error) {
      console.warn(
        `Tree-sitter extraction failed for ${path}, falling back to regex:`,
        error,
      );
    }
  }

  // Fall back to regex patterns
  const patterns =
    FUNCTION_PATTERNS[ext] || FUNCTION_PATTERNS[language.toLowerCase()] || [];

  if (!patterns.length) {
    return [];
  }

  const functions: ExtractedFunction[] = [];

  for (const { regex, extract } of patterns) {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const extracted = extract(match);
      if (extracted) {
        // Count lines to get approximate line number
        const before = content.substring(0, match.index);
        const lineNumber = before.split("\n").length;

        functions.push({
          ...extracted,
          path,
          line: lineNumber,
        });
      }
    }
  }

  // Deduplicate by name + line (same function might match multiple patterns)
  const seen = new Set<string>();
  return functions.filter((f) => {
    const key = `${f.path}:${f.line}:${f.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Convert extracted functions to GraphNode format
 */
export function functionsToNodes(functions: ExtractedFunction[]): GraphNode[] {
  return functions.map((f) => ({
    id: `func:${f.path}:${f.name}:${f.line}`,
    label: f.name,
    kind: "function",
    path: f.path,
    loc: 1, // Will be updated by actual LOC counting
    complexity: 1, // Base complexity
    group: f.path.split("/").slice(0, -1).join("/") || "root",
    language: f.language,
    entrypoint: false,
    // Store additional metadata
    functionData: {
      parameters: f.parameters,
      isMethod: f.isMethod,
      className: f.className,
      line: f.line,
    },
  }));
}

/**
 * Scope-aware call resolution: given a callee name and the caller's path +
 * module, find the best matching function node. Priority:
 * 1. Same file       (most precise — local function)
 * 2. Same module     (sibling file)
 * 3. Different module (any match — may be false positive)
 *
 * Returns the highest-priority match(es) or empty array.
 */
function resolveCalleeScope(
  calleeName: string,
  callerPath: string,
  callerModule: string | undefined,
  functionNodes: GraphNode[],
  moduleFor: (path: string) => string,
): GraphNode[] {
  const sameFile: GraphNode[] = [];
  const sameModule: GraphNode[] = [];
  const other: GraphNode[] = [];

  for (const fn of functionNodes) {
    if (fn.label !== calleeName) continue;

    if (fn.path === callerPath) {
      sameFile.push(fn);
    } else if (callerModule && moduleFor(fn.path ?? "") === callerModule) {
      sameModule.push(fn);
    } else {
      other.push(fn);
    }
  }

  if (sameFile.length > 0) return sameFile;
  if (sameModule.length > 0) return sameModule;
  return other;
}

/**
 * Extract function calls from code to build call graph.
 * Uses Tree-sitter for accurate AST-based extraction when available
 * (reducing false positives from regex), then applies scope-aware
 * resolution to prioritize same-file and same-module matches.
 */
export async function extractFunctionCalls(
  filePath: string,
  fileId: string,
  content: string,
  language: string,
  functionNodes: GraphNode[],
  moduleFor?: (path: string) => string,
): Promise<GraphEdge[]> {
  const calls: GraphEdge[] = [];

  // Phase 1: Try Tree-sitter for accurate call extraction
  let callExpressions: Array<{ calleeName: string; isMethodCall: boolean }>;
  try {
    const tsCalls = await extractCallsWithTreeSitter(
      filePath,
      content,
      language,
    );
    callExpressions = tsCalls;
  } catch {
    callExpressions = [];
  }

  // Phase 2: If Tree-sitter returned nothing, fall back to regex
  if (callExpressions.length === 0) {
    callExpressions = extractCallsWithRegex(filePath, content, language);
  }

  // Phase 3: Resolve each call to function nodes using scope-aware resolution
  for (const { calleeName } of callExpressions) {
    const matches = resolveCalleeScope(
      calleeName,
      filePath,
      moduleFor ? moduleFor(filePath) : undefined,
      functionNodes,
      moduleFor ?? (() => ""),
    );
    for (const callee of matches) {
      calls.push({
        source: fileId,
        target: callee.id,
        weight: 1,
        kind: "call",
      });
    }
  }

  return calls;
}

/**
 * Regex-based call extraction (fallback when Tree-sitter is unavailable).
 */
function extractCallsWithRegex(
  filePath: string,
  content: string,
  language: string,
): Array<{ calleeName: string; isMethodCall: boolean }> {
  const ext =
    filePath.split(".").pop()?.toLowerCase() ?? language.toLowerCase();

  const CALL_PATTERNS: Record<string, RegExp[]> = {
    ts: [
      /([a-zA-Z_$][\w$]*)\s*\(/g,
      /this\.([a-zA-Z_$][\w$]*)\s*\(/g,
      /[a-zA-Z_$][\w$]*\.([a-zA-Z_$][\w$]*)\s*\(/g,
    ],
    js: [
      /([a-zA-Z_$][\w$]*)\s*\(/g,
      /this\.([a-zA-Z_$][\w$]*)\s*\(/g,
      /[a-zA-Z_$][\w$]*\.([a-zA-Z_$][\w$]*)\s*\(/g,
    ],
    py: [
      /([a-zA-Z_][\w]*)\s*\(/g,
      /self\.([a-zA-Z_][\w]*)\s*\(/g,
      /[a-zA-Z_][\w]*\.([a-zA-Z_][\w]*)\s*\(/g,
    ],
    go: [/([a-zA-Z_][\w]*)\s*\(/g, /[a-zA-Z_][\w]*\.([a-zA-Z_][\w]*)\s*\(/g],
    rs: [/([a-zA-Z_][\w]*)\s*\(/g, /self\.([a-zA-Z_][\w]*)\s*\(/g],
    java: [
      /([a-zA-Z_][\w]*)\s*\(/g,
      /this\.([a-zA-Z_][\w]*)\s*\(/g,
      /[a-zA-Z_][\w]*\.([a-zA-Z_][\w]*)\s*\(/g,
    ],
    c: [/([a-zA-Z_][\w]*)\s*\(/g],
    cpp: [/([a-zA-Z_][\w]*)\s*\(/g, /[a-zA-Z_][\w]*::([a-zA-Z_][\w]*)\s*\(/g],
    php: [
      /([a-zA-Z_][\w]*)\s*\(/g,
      /this->([a-zA-Z_][\w]*)\s*\(/g,
      /[a-zA-Z_][\w]*->([a-zA-Z_][\w]*)\s*\(/g,
    ],
    rb: [/([a-zA-Z_][\w?]*)\s*\(/g, /[a-zA-Z_][\w?]*\.([a-zA-Z_][\w?]*)\s*\(/g],
    swift: [/([a-zA-Z_][\w]*)\s*\(/g, /self\.([a-zA-Z_][\w]*)\s*\(/g],
    kt: [/([a-zA-Z_][\w]*)\s*\(/g, /this\.([a-zA-Z_][\w]*)\s*\(/g],
    scala: [/([a-zA-Z_][\w]*)\s*\(/g, /this\.([a-zA-Z_][\w]*)\s*\(/g],
  };

  const patterns = CALL_PATTERNS[ext] || [];
  const keywords = new Set([
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
    "public",
    "private",
    "protected",
    "static",
    "final",
    "abstract",
    "native",
    "synchronized",
    "volatile",
    "transient",
    "strictfp",
    "interface",
    "implements",
    "extends",
    "super",
    "this",
    "null",
    "true",
    "false",
    "undefined",
    "NaN",
    "Infinity",
    "eval",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "decodeURI",
    "encodeURI",
    "decodeURIComponent",
    "encodeURIComponent",
  ]);

  const results: Array<{ calleeName: string; isMethodCall: boolean }> = [];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const calleeName = match[1] || match[2];
      if (!calleeName || keywords.has(calleeName)) continue;
      results.push({ calleeName, isMethodCall: match[0].includes(".") });
    }
  }

  return results;
}
