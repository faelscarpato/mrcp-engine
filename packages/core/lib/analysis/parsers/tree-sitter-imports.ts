import type { ImportRef } from "./imports.js";
import {
  TreeSitterNode,
  EXTENSION_TO_LANGUAGE_MAP,
  initTreeSitter,
  getParser,
  loadLanguage,
} from "./tree-sitter-loader.js";

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
  php: [
    "include_expression",
    "require_expression",
    "namespace_use_declaration",
  ],
  ruby: ["require", "require_relative", "load"],
  cobol: ["copy_statement"],
  pascal: ["uses_clause"],
  cds: ["using_statement"],
  abap: ["include_statement", "tables_statement", "type_pools_statement"],
  plsql: ["package_specification", "package_body_definition"],
  oracle_plsql: ["package_specification", "package_body_definition"],
  rpgle: ["compiler_directive"],
  jcl: ["exec_statement"],
  tsql: ["execute_statement"],
  structured_text: ["using_directive", "var_external"],
  iec61131: ["using_directive", "var_external"],
  mql5: ["preprocessor_include"],
  openedge_abl: ["run_statement"],
  abl: ["run_statement"],
  // Novas linguagens integradas
  c_sharp: ["using_directive", "global_using_directive"],
  cs: ["using_directive", "global_using_directive"],
  swift: ["import_declaration"],
  kotlin: ["import_header"],
  actionscript: ["import_statement"],
  applescript: ["tell_statement"],
  ahk: ["directive"],
  autoit: ["include_directive", "preprocessor_directive"],
  bicep: ["module_declaration"],
  pipeline: [
    "gha_uses_step",
    "jenkins_docker_agent",
    "jenkins_kubernetes_agent",
  ],
  cfml: ["script_component", "tag_component"],
  verse: ["using_directive"],
  q: ["system_command"],
  modelica: ["extends_clause"],
  objectscript: ["include_directive"],
  natural: [
    "include_statement",
    "global_data_section",
    "parameter_data_section",
    "local_data_section",
  ],
  openscad: ["include_statement", "use_statement"],
  pawn: ["include_directive"],
  apex: ["annotation", "class_declaration"],
  sas: [
    "libname_statement",
    "filename_statement",
    "set_statement",
    "merge_statement",
  ],
  scl: ["data_block_definition", "symbolic_reference"],
  vba: ["declare_statement", "set_assignment_statement"],
  vhdl: ["library_clause", "use_clause"],
  web3: ["move_use_declaration", "vyper_import_statement"],
  vyper: ["vyper_import_statement"],
  move: ["move_use_declaration"],
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
  if (src) {
    const t = src.text;
    return t.replace(/^["'`]|["'`]$/g, "");
  }
  const strs = collectStrings(node, 2);
  if (strs.length > 0) {
    return strs[strs.length - 1];
  }
  const match = node.text.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : null;
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
  const treeSitterLang =
    EXTENSION_TO_LANGUAGE_MAP[ext] || language.toLowerCase();
  const nodeTypes = IMPORT_NODE_TYPES[treeSitterLang];

  if (!nodeTypes || nodeTypes.length === 0) {
    return { imports: [] };
  }

  await initTreeSitter();
  const parser = getParser();
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
        if (
          node.type === "import_from_statement" ||
          node.type === "import_from"
        ) {
          const mod =
            getField(node, "module_name") ??
            getField(node, "module") ??
            node.namedChildren?.[0];
          if (mod) push(mod.text);
          return;
        }
        if (node.type === "import_statement") {
          for (const c of node.namedChildren ?? []) {
            if (c.type === "dotted_name" || c.type === "identifier")
              push(c.text);
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
          const t = node.text
            .replace(/^import\s+(static\s+)?/, "")
            .replace(/;$/, "")
            .trim();
          if (t) push(t);
          return;
        }
      }

      if (treeSitterLang === "c" || treeSitterLang === "cpp") {
        if (node.type === "preproc_include") {
          const pathChild = node.namedChildren?.[0];
          const t = pathChild
            ? pathChild.text.replace(/^[<"']|[> "']$/g, "")
            : node.text
                .replace(/^#include\s+/, "")
                .replace(/[<"'>]/g, "")
                .trim();
          if (t) push(t);
          return;
        }
      }

      if (treeSitterLang === "abap" || treeSitterLang === "sap_abap") {
        if (
          node.type === "include_statement" ||
          node.type === "tables_statement"
        ) {
          const nameChild = node.namedChildren.find(
            (c) => c.type === "identifier",
          );
          if (nameChild) push(nameChild.text);
          return;
        }
      }

      if (treeSitterLang === "cds" || treeSitterLang === "sap_cds") {
        const match =
          node.text.match(/from\s+['"]([^'"]+)['"]/i) ||
          node.text.match(/using\s+['"]([^'"]+)['"]/i);
        if (match) {
          push(match[1]);
          return;
        }
        const strs = collectStrings(node, 3);
        for (const s of strs) push(s);
        if (node.type === "using_statement" || node.type === "ERROR") {
          return;
        }
      }

      // Generic handler for extended languages
      if (nodeTypes.includes(node.type)) {
        const directField =
          getField(node, "path") ??
          getField(node, "name") ??
          getField(node, "source") ??
          getField(node, "module") ??
          getField(node, "unit") ??
          getField(node, "file") ??
          getField(node, "action") ??
          getField(node, "lib_name");
        if (directField) {
          const cleanText = directField.text
            .replace(/^["'`<]|[>"'`]$/g, "")
            .trim();
          if (cleanText) {
            push(cleanText);
            return;
          }
        }
        const strs = collectStrings(node, 2);
        if (strs.length > 0) {
          push(strs[strs.length - 1]);
          return;
        }
        for (const child of node.namedChildren ?? []) {
          if (
            child.type === "identifier" ||
            child.type === "scoped_identifier" ||
            child.type === "dotted_name"
          ) {
            push(child.text.trim());
            return;
          }
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
