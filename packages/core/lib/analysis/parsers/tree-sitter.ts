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

function createSapFallbackFunctions(
  path: string,
  content: string,
  language: string,
): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  const add = (name: string, index: number) => {
    const line = content.slice(0, index).split(/\r?\n/).length;
    functions.push({
      name,
      path,
      language,
      line,
      complexity: 1,
      lines: 1,
    });
  };

  const normalized = language.toLowerCase();

  if (normalized === "abap" || normalized === "sap_abap") {
    const pattern = /^\s*METHOD\s+([A-Za-z_][A-Za-z0-9_]*)\s*\./gim;
    for (const match of content.matchAll(pattern)) {
      if (match.index !== undefined) {
        add(match[1], match.index);
      }
    }
    return functions;
  }

  if (normalized === "cds" || normalized === "sap_cds") {
    const patterns = [
      /^\s*DEFINE\s+(?:ROOT\s+)?VIEW(?:\s+ENTITY)?\s+([A-Za-z_][A-Za-z0-9_]*)/gim,
      /^\s*DEFINE\s+(?:ROOT\s+)?VIEW\s+ENTITY\s+([A-Za-z_][A-Za-z0-9_]*)/gim,
    ];

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        if (match.index !== undefined) {
          add(match[1], match.index);
        }
      }
    }

    return functions;
  }

  return functions;
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
  pascal: [
    "function_declaration",
    "procedure_declaration",
    "subprogram_header",
    "type_declaration",
    "unit_declaration",
    "program_declaration",
  ],
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
  rpgle: ["procedure_definition", "subroutine_definition"],
  pine: ["function_declaration", "user_defined_function"],
  jcl: ["job_statement", "exec_statement", "proc_statement"],
  powerquery: ["function_expression", "section_member"],
  powerquery_m: ["function_expression", "section_member"],
  dax: ["measure_definition", "evaluate_statement"],
  tsql: [
    "create_procedure_statement",
    "create_function_statement",
    "create_trigger_statement",
  ],
  structured_text: [
    "function_declaration",
    "function_block_declaration",
    "program_declaration",
  ],
  iec61131: [
    "function_declaration",
    "function_block_declaration",
    "program_declaration",
  ],
  mql5: ["function_definition", "method_definition"],
  openedge_abl: [
    "procedure_definition",
    "function_definition",
    "method_definition",
  ],
  abl: ["procedure_definition", "function_definition", "method_definition"],
  // Novas linguagens integradas
  c_sharp: [
    "method_declaration",
    "constructor_declaration",
    "class_declaration",
    "record_declaration",
    "struct_declaration",
    "interface_declaration",
    "property_declaration",
  ],
  cs: [
    "method_declaration",
    "constructor_declaration",
    "class_declaration",
    "record_declaration",
    "struct_declaration",
    "interface_declaration",
    "property_declaration",
  ],
  swift: [
    "function_declaration",
    "initializer_declaration",
    "class_declaration",
    "struct_declaration",
    "actor_declaration",
    "protocol_declaration",
    "enum_declaration",
    "extension_declaration",
  ],
  kotlin: [
    "function_declaration",
    "class_declaration",
    "object_declaration",
    "companion_object",
    "property_declaration",
  ],
  actionscript: [
    "method_definition",
    "class_definition",
    "interface_definition",
    "mxml_element",
    "package_definition",
  ],
  applescript: ["handler_definition", "script_object_definition"],
  ahk: [
    "function_definition",
    "hotkey_definition",
    "hotstring_definition",
    "class_definition",
    "method_definition",
    "property_definition",
  ],
  autoit: ["function_definition"],
  bicep: [
    "resource_declaration",
    "module_declaration",
    "parameter_declaration",
    "variable_declaration",
    "output_declaration",
    "type_declaration",
  ],
  pipeline: [
    "jenkins_stage_block",
    "jenkins_axis_block",
    "jenkins_parameter_declaration",
    "jenkins_env_assignment",
  ],
  cfml: [
    "script_function",
    "tag_function",
    "script_component",
    "tag_component",
    "cfquery_tag",
  ],
  verse: [
    "function_definition",
    "class_definition",
    "interface_definition",
    "module_definition",
  ],
  q: ["assignment_statement", "lambda", "table_literal"],
  modelica: ["class_definition", "component_declaration"],
  objectscript: [
    "class_definition",
    "method_definition",
    "trigger_definition",
    "query_definition",
    "label_definition",
  ],
  natural: ["subroutine_definition", "function_definition", "view_definition"],
  openscad: ["module_definition", "function_definition"],
  pawn: ["function_definition", "native_declaration", "forward_declaration"],
  apex: [
    "method_declaration",
    "constructor_declaration",
    "interface_method",
    "trigger_declaration",
    "class_declaration",
    "interface_declaration",
  ],
  sas: ["macro_definition", "data_step", "proc_step", "proc_sql_step"],
  scl: [
    "function_block_definition",
    "function_definition",
    "organization_block_definition",
    "data_block_definition",
    "type_definition",
  ],
  vba: [
    "sub_definition",
    "function_definition",
    "property_definition",
    "declare_statement",
    "type_definition",
    "enum_definition",
  ],
  vhdl: [
    "entity_declaration",
    "architecture_body",
    "process_statement",
    "subprogram_body",
    "package_declaration",
  ],
  web3: [
    "vyper_function_definition",
    "move_function_definition",
    "move_module_definition",
    "move_struct_definition",
    "vyper_struct_definition",
    "vyper_event_definition",
  ],
  vyper: [
    "vyper_function_definition",
    "vyper_struct_definition",
    "vyper_event_definition",
  ],
  move: [
    "move_function_definition",
    "move_module_definition",
    "move_struct_definition",
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
  const directFields = [
    "name",
    "label",
    "view_name",
    "output_datasets",
    "trigger",
    "routine",
    "subroutine",
    "subprogram",
    "program",
    "step_name",
    "instantiated_unit",
  ];
  for (const f of directFields) {
    const val = getField(node, f);
    if (val && val.text) return val.text;
  }

  const headerField = getField(node, "header");
  if (headerField) {
    const headerName = getField(headerField, "name");
    if (headerName && headerName.text) return headerName.text;
    for (const c of headerField.namedChildren ?? []) {
      if (c.type === "identifier" || c.type === "name") return c.text;
    }
  }

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
      child.type === "word" ||
      child.type === "symbol" ||
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
      type === "logical_or" ||
      type === "elsif_clause" ||
      type === "elif_clause" ||
      type === "when_clause" ||
      type === "when_branch" ||
      type === "switch_case" ||
      type === "match_arm" ||
      type === "guard_statement" ||
      type === "repeat_statement" ||
      type === "loop_statement" ||
      type === "dow_statement" ||
      type === "dou_statement" ||
      type === "catch_statement"
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

  const fallback = () =>
    createSapFallbackFunctions(path, content, treeSitterLang);

  if (!functionTypes || functionTypes.length === 0) {
    return { functions: fallback() };
  }

  await initTreeSitter();
  const parser = getParser();
  if (!parser) {
    return { functions: fallback() };
  }

  const loadedLanguage = await loadLanguage(treeSitterLang);
  if (!loadedLanguage) {
    return { functions: fallback() };
  }

  try {
    parser.setLanguage(loadedLanguage);
    const tree = parser.parse(content);
    if (!tree) {
      return { functions: fallback() };
    }

    const functions = extractFunctions(
      tree.rootNode,
      content,
      functionTypes,
      path,
      treeSitterLang,
    );

    return {
      functions: functions.length > 0 ? functions : fallback(),
    };
  } catch (error) {
    console.error(`Failed to parse ${path} with Tree-sitter:`, error);
    return { functions: fallback() };
  }
}
