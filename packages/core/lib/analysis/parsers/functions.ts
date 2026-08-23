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

import { FUNCTION_PATTERNS } from "./function-patterns.js";
export { FUNCTION_PATTERNS } from "./function-patterns.js";

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
      const tsRes = await extractFunctionsWithTreeSitter(
        path,
        content,
        ext,
      );
      const treeSitterFunctions = Array.isArray(tsRes) ? tsRes : (tsRes?.functions ?? []);
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
  return functions.map((f) => {
    const fPath = f.path || "unknown";
    return {
      id: `func:${fPath}:${f.name}:${f.line}`,
      label: f.name,
      kind: "function",
      path: fPath,
      loc: f.lines || 1,
      complexity: f.complexity || 1,
      group: fPath.split("/").slice(0, -1).join("/") || "root",
      language: f.language,
      entrypoint: false,
      functionData: {
        parameters: f.parameters,
        isMethod: f.isMethod,
        className: f.className,
        line: f.line,
      },
    };
  });
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
