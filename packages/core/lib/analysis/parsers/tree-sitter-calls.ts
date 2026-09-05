import {
  TreeSitterNode,
  EXTENSION_TO_LANGUAGE_MAP,
  initTreeSitter,
  getParser,
  loadLanguage,
} from "./tree-sitter-loader.js";

export interface CallExpression {
  calleeName: string;
  callerLine: number;
  isMethodCall: boolean;
}

const CALL_NODE_TYPES: Record<string, string[]> = {
  javascript: ["call_expression", "new_expression"],
  typescript: ["call_expression", "new_expression"],
  tsx: ["call_expression", "new_expression"],
  python: ["call"],
  go: ["call_expression"],
  rust: ["call_expression", "macro_invocation"],
  java: ["method_invocation", "object_creation_expression"],
  cpp: ["call_expression"],
  c: ["call_expression"],
  php: [
    "function_call_expression",
    "method_call_expression",
    "scoped_call_expression",
  ],
  ruby: ["call", "method_call"],
  cds: ["function_call"],
  sap_cds: ["function_call"],
  abap: ["method_call_statement", "perform_statement", "call_statement"],
  sap_abap: ["method_call_statement", "perform_statement", "call_statement"],
  plsql: ["function_call", "procedure_call", "sql_statement"],
  oracle_plsql: ["function_call", "procedure_call", "sql_statement"],
};

function getField(
  node: TreeSitterNode,
  fieldName: string,
): TreeSitterNode | null {
  if (typeof node.field === "function") {
    return node.field(fieldName);
  }
  return null;
}

function extractCalleeName(
  node: TreeSitterNode,
): { name: string; isMethod: boolean } | null {
  if (
    node.type === "call_expression" ||
    node.type === "new_expression" ||
    node.type === "call"
  ) {
    const fn =
      getField(node, "function") ??
      (node.namedChildren && node.namedChildren.length > 0
        ? node.namedChildren[0]
        : null);
    if (fn) {
      if (fn.type === "identifier" || fn.type === "type_identifier") {
        return { name: fn.text, isMethod: false };
      }
      if (fn.type === "member_expression" || fn.type === "attribute") {
        const prop =
          getField(fn, "property") ??
          getField(fn, "attribute") ??
          (fn.namedChildren && fn.namedChildren.length > 1
            ? fn.namedChildren[1]
            : null);
        if (
          prop &&
          (prop.type === "property_identifier" || prop.type === "identifier")
        ) {
          return { name: prop.text, isMethod: true };
        }
      }
    }
  }

  if (node.type === "method_invocation") {
    const name = getField(node, "name");
    if (
      name &&
      (name.type === "identifier" || name.type === "type_identifier")
    ) {
      return { name: name.text, isMethod: true };
    }
  }

  if (node.type === "macro_invocation") {
    const macro = getField(node, "macro");
    if (macro && macro.type === "identifier") {
      return { name: macro.text + "!", isMethod: false };
    }
  }

  return null;
}

function collectCallExpressions(
  root: TreeSitterNode,
  nodeTypes: string[],
): CallExpression[] {
  const out: CallExpression[] = [];
  const typeSet = new Set(nodeTypes);

  const visit = (node: TreeSitterNode) => {
    if (typeSet.has(node.type)) {
      const extracted = extractCalleeName(node);
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
  const treeSitterLang =
    EXTENSION_TO_LANGUAGE_MAP[ext] || language.toLowerCase();
  const nodeTypes = CALL_NODE_TYPES[treeSitterLang];
  if (!nodeTypes || nodeTypes.length === 0) return [];

  await initTreeSitter();
  const parser = getParser();
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
