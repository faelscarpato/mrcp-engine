import type { ExtractedFunction } from "./functions.js";
import {
  TreeSitterNode,
  LANGUAGE_WASM_MAP,
  EXTENSION_TO_LANGUAGE_MAP,
  initTreeSitter,
  getParser,
  loadLanguage,
} from "./tree-sitter-loader.js";
import {
  CallExpression,
  extractCallsWithTreeSitter,
} from "./tree-sitter-calls.js";
import {
  TreeSitterImportResult,
  extractImportsWithTreeSitter,
} from "./tree-sitter-imports.js";

// Re-export everything for seamless backward compatibility
export * from "./tree-sitter-loader.js";
export * from "./tree-sitter-calls.js";
export * from "./tree-sitter-imports.js";

export interface TreeSitterParseResult {
  functions: ExtractedFunction[];
}

export function isTreeSitterAvailable(langOrExt: string): boolean {
  if (!langOrExt) return false;
  const key = langOrExt.toLowerCase();
  const lang = EXTENSION_TO_LANGUAGE_MAP[key] || key;
  return Boolean(LANGUAGE_WASM_MAP[lang] || FUNCTION_NODE_TYPES[lang]);
}

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
  sap_abap: [
    "method_implementation",
    "method_definition_item",
    "report_statement",
  ],
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

function getField(
  node: TreeSitterNode,
  fieldName: string,
): TreeSitterNode | null {
  if (typeof node.field === "function") {
    return node.field(fieldName);
  }
  return null;
}

function extractFunctionName(
  node: TreeSitterNode,
  parent?: TreeSitterNode,
): string {
  const nameField = getField(node, "name");
  if (nameField) return nameField.text;

  if (node.type === "arrow_function" || node.type === "function_expression") {
    if (parent && parent.type === "variable_declarator") {
      const parentName = getField(parent, "name");
      if (parentName) return parentName.text;
    }
  }

  for (const child of node.namedChildren ?? []) {
    if (
      child.type === "identifier" ||
      child.type === "name" ||
      child.type === "property_identifier" ||
      child.type === "function_declarator" ||
      child.type === "type_identifier"
    ) {
      if (child.type === "function_declarator") {
        return extractFunctionName(child);
      }
      return child.text;
    }
  }

  return "anonymous";
}

function calculateComplexity(node: TreeSitterNode): number {
  let complexity = 1;

  function traverse(n: TreeSitterNode) {
    const type = n.type;
    if (
      type === "if_statement" ||
      type === "for_statement" ||
      type === "while_statement" ||
      type === "do_statement" ||
      type === "case_clause" ||
      type === "catch_clause" ||
      type === "conditional_expression" ||
      type === "logical_and" ||
      type === "logical_or"
    ) {
      complexity++;
    }
    for (const child of n.namedChildren ?? []) {
      traverse(child);
    }
  }

  traverse(node);
  return complexity;
}

function countLines(node: TreeSitterNode): number {
  return node.endPosition.row - node.startPosition.row + 1;
}

function extractFunctions(
  node: TreeSitterNode,
  content: string,
  functionTypes: string[],
  filePath: string,
  language: string,
  parent?: TreeSitterNode,
): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  if (functionTypes.includes(node.type)) {
    const name = extractFunctionName(node, parent);
    const complexity = calculateComplexity(node);
    const lines = countLines(node);
    const line = node.startPosition.row + 1;

    functions.push({
      name,
      path: filePath,
      language,
      line,
      complexity,
      lines,
    });
  }

  for (const child of node.namedChildren ?? []) {
    functions.push(
      ...extractFunctions(
        child,
        content,
        functionTypes,
        filePath,
        language,
        node,
      ),
    );
  }

  return functions;
}

export async function extractFunctionsWithTreeSitter(
  path: string,
  content: string,
  language: string,
): Promise<TreeSitterParseResult> {
  const ext = path.split(".").pop()?.toLowerCase() ?? language.toLowerCase();
  const treeSitterLang =
    EXTENSION_TO_LANGUAGE_MAP[ext] || language.toLowerCase();
  const functionTypes = FUNCTION_NODE_TYPES[treeSitterLang];

  if (!functionTypes || functionTypes.length === 0) {
    return { functions: [] };
  }

  await initTreeSitter();
  const parser = getParser();
  if (!parser) {
    return { functions: [] };
  }

  const loadedLanguage = await loadLanguage(treeSitterLang);
  if (!loadedLanguage) {
    return { functions: [] };
  }

  try {
    parser.setLanguage(loadedLanguage);
    const tree = parser.parse(content);
    if (!tree) {
      return { functions: [] };
    }

    const functions = extractFunctions(
      tree.rootNode,
      content,
      functionTypes,
      path,
      treeSitterLang,
    );
    return { functions };
  } catch (error) {
    console.error(`Failed to parse ${path} with Tree-sitter:`, error);
    return { functions: [] };
  }
}
