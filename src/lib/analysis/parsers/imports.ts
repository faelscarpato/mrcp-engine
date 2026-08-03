// Best-effort regex parsers for common languages. Not a real AST — trades
// completeness for zero-dep, browser-safe execution.

const JS_IMPORT_RE = [
  /\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
];

const PY_IMPORT_RE = [
  /^\s*from\s+([\w.]+)\s+import\b/gm,
  /^\s*import\s+([\w.]+)/gm,
];

const GO_IMPORT_RE = [/\bimport\s+"([^"]+)"/g, /\bimport\s*\(([\s\S]*?)\)/g];

// Rust: use crate:: or mod, extern crate (2015 edition), or use std::
const RS_IMPORT_RE = [
  /\buse\s+([\w:]+)\s*;/g,
  /\bextern\s+crate\s+([\w]+)\s*;/g,
];

// Java: import package.name.Class;
const JAVA_IMPORT_RE = [/\bimport\s+([\w.]+)\s*;/g];

// Kotlin: import package.name.Class
const KT_IMPORT_RE = [/\bimport\s+([\w.]+)\s*/g];

// Ruby: require 'file' or require_relative 'file'
const RB_IMPORT_RE = [
  /\brequire\s+["']([^"']+)["']/g,
  /\brequire_relative\s+["']([^"']+)["']/g,
];

// PHP: require, require_once, include, include_once
const PHP_IMPORT_RE = [
  /\brequire\s+["']([^"']+)["']/g,
  /\brequire_once\s+["']([^"']+)["']/g,
  /\binclude\s+["']([^"']+)["']/g,
  /\binclude_once\s+["']([^"']+)["']/g,
];

// C#: using namespace;
const CS_IMPORT_RE = [/\busing\s+([\w.]+)\s*;/g];

// C/C++: #include <file> or #include "file"
const C_CPP_IMPORT_RE = [/#\s*include\s+[<"]([^>"]+)[>"]/g];

// Swift: import Module
const SWIFT_IMPORT_RE = [/\bimport\s+([\w.]+)/g];

// Scala: import package.name._
const SCALA_IMPORT_RE = [/\bimport\s+([\w.]+)\s*/g];

// Dart: import 'package:name/name.dart';
const DART_IMPORT_RE = [/\bimport\s+["']([^"']+)["']\s*;/g];

// Lua: require("module")
const LUA_IMPORT_RE = [/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g];

// Elixir: require Module or import Module
const ELIXIR_IMPORT_RE = [/\brequire\s+([\w.]+)/g, /\bimport\s+([\w.]+)/g];

// Erlang: -module() or -import()
const ERLANG_IMPORT_RE = [/\b-import\s*\(\s*([\w,]+)\s*\)/g];

// Haskell: import Module (functions)
const HASKELL_IMPORT_RE = [/\bimport\s+([\w.]+)\s*/g];

// Clojure: (ns my.namespace (:require [other.namespace :as alias]))
const CLOJURE_IMPORT_RE = [/\(:require\s+\[([^\]]+)\]/g];

// F#: open Module or module recreation
const FSHARP_IMPORT_RE = [/\bopen\s+([\w.]+)/g];

// SQL: Not applicable for imports, but we can detect includes
const SQL_IMPORT_RE = [/\b--\s*#include\s+["']([^"']+)["']/g];

// GraphQL: Not applicable for imports
const GRAPHQL_IMPORT_RE = [];

export interface ImportRef {
  raw: string;
  isRelative: boolean;
}

export function extractImports(path: string, content: string): ImportRef[] {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const out: ImportRef[] = [];

  // Helper to extract imports from regex patterns
  const extractFromPatterns = (
    patterns: RegExp[],
    isRelativeFn: (s: string) => boolean,
  ) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        const raw = m[1];
        // Skip empty matches
        if (!raw || raw.trim() === "") continue;
        out.push({ raw: raw.trim(), isRelative: isRelativeFn(raw) });
      }
    }
  };

  if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "vue", "svelte"].includes(ext)) {
    extractFromPatterns(
      JS_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/"),
    );
  } else if (ext === "py") {
    extractFromPatterns(PY_IMPORT_RE, (s) => s.startsWith("."));
  } else if (ext === "go") {
    // Single-line imports
    GO_IMPORT_RE[0].lastIndex = 0;
    let m;
    while ((m = GO_IMPORT_RE[0].exec(content)) !== null) {
      const raw = m[1];
      if (!raw || raw.trim() === "") continue;
      out.push({
        raw: raw.trim(),
        isRelative: raw.startsWith(".") || raw.startsWith("/"),
      });
    }
    // Grouped
    GO_IMPORT_RE[1].lastIndex = 0;
    while ((m = GO_IMPORT_RE[1].exec(content)) !== null) {
      const inner = m[1];
      const line = /"([^"]+)"/g;
      let mm;
      while ((mm = line.exec(inner)) !== null) {
        const raw = mm[1];
        if (!raw || raw.trim() === "") continue;
        out.push({
          raw: raw.trim(),
          isRelative: raw.startsWith(".") || raw.startsWith("/"),
        });
      }
    }
  } else if (ext === "rs") {
    // Rust imports
    extractFromPatterns(
      RS_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/") || s.includes("::"),
    );
  } else if (ext === "java") {
    // Java imports
    extractFromPatterns(JAVA_IMPORT_RE, (s) => s.startsWith("."));
  } else if (ext === "kt") {
    // Kotlin imports
    extractFromPatterns(KT_IMPORT_RE, (s) => s.startsWith("."));
  } else if (["rb", "ruby"].includes(ext)) {
    // Ruby requires
    extractFromPatterns(
      RB_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/"),
    );
  } else if (["php", "phtml"].includes(ext)) {
    // PHP includes
    extractFromPatterns(
      PHP_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/"),
    );
  } else if (ext === "cs") {
    // C# using statements
    extractFromPatterns(CS_IMPORT_RE, (s) => false); // C# namespaces are not relative
  } else if (["c", "cpp", "cc", "cxx", "h", "hpp", "hxx"].includes(ext)) {
    // C/C++ includes
    extractFromPatterns(
      C_CPP_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/"),
    );
  } else if (ext === "swift") {
    // Swift imports
    extractFromPatterns(SWIFT_IMPORT_RE, (s) => false); // Swift modules are not relative
  } else if (ext === "scala") {
    // Scala imports
    extractFromPatterns(SCALA_IMPORT_RE, (s) => s.startsWith("."));
  } else if (ext === "dart") {
    // Dart imports
    extractFromPatterns(
      DART_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/") || s.startsWith("package:"),
    );
  } else if (ext === "lua") {
    // Lua requires
    extractFromPatterns(
      LUA_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/"),
    );
  } else if (["ex", "exs"].includes(ext)) {
    // Elixir imports
    extractFromPatterns(ELIXIR_IMPORT_RE, (s) => s.startsWith("."));
  } else if (["erl", "hrl"].includes(ext)) {
    // Erlang imports
    extractFromPatterns(ERLANG_IMPORT_RE, (s) => false);
  } else if (ext === "hs") {
    // Haskell imports
    extractFromPatterns(HASKELL_IMPORT_RE, (s) => false);
  } else if (ext === "clj") {
    // Clojure requires
    extractFromPatterns(CLOJURE_IMPORT_RE, (s) => s.startsWith("."));
  } else if (ext === "fs") {
    // F# opens
    extractFromPatterns(FSHARP_IMPORT_RE, (s) => false);
  } else if (ext === "sql") {
    // SQL includes (non-standard)
    extractFromPatterns(
      SQL_IMPORT_RE,
      (s) => s.startsWith(".") || s.startsWith("/"),
    );
  }

  return out;
}

// Approximate cyclomatic complexity: branches + loops + logical operators.
export function estimateComplexity(content: string): number {
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*[^:]*:/g,
    /&&/g,
    /\|\|/g,
  ];
  let c = 1;
  for (const p of patterns) {
    const m = content.match(p);
    if (m) c += m.length;
  }
  return c;
}

export function countLines(content: string): number {
  return content.split(/\r?\n/).length;
}

// Resolve a relative import to a file path within the repo file set.
export function resolveImport(
  fromPath: string,
  spec: string,
  fileSet: Set<string>,
): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const fromDir = fromPath.split("/").slice(0, -1).join("/");
  const parts = (fromDir + "/" + spec).split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  const base = stack.join("/");
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
    `${base}.py`,
    `${base}/__init__.py`,
    `${base}.go`,
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

// ---------------------------------------------------------------------------
// TypeScript / JavaScript path-alias resolution (Sprint 3, task 2.5)
// ---------------------------------------------------------------------------

/**
 * A mapping from an alias prefix (e.g. `@/*`) to a list of target glob
 * patterns (e.g. `src/*`). The alias `${aliasKey}` (without `*`) is the
 * literal prefix; targets store the suffix paths in the same form.
 */
export interface TsAliasEntry {
  aliasKey: string; // alias with `*` stripped, e.g. `@/`
  aliasHasWildcard: boolean;
  targets: string[]; // e.g. `src/` (without `*`), relative to baseUrl
  baseUrl: string; // e.g. `.` or `packages/web/src`
}

/**
 * Build a list of TS path-alias entries by scanning all `tsconfig*.json` files
 * in the dataset. Each `tsconfig.json` contributes the union of its
 * `compilerOptions.paths` combined with its `compilerOptions.baseUrl`.
 *
 * Robust to malformed JSON; silently skips configs without `paths`.
 */
export function buildAliasMap(
  files: Array<{ path: string; content?: string }>,
): TsAliasEntry[] {
  const out: TsAliasEntry[] = [];

  for (const f of files) {
    const name = f.path.split("/").pop()?.toLowerCase() ?? "";
    // Only root or first-level tsconfigs — avoid node_modules noise.
    const isTsConfig =
      name === "tsconfig.json" || /^tsconfig\..+\.json$/i.test(name);
    if (!isTsConfig || !f.content) continue;

    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(f.content);
    } catch {
      continue;
    }

    const compilerOptions = cfg.compilerOptions as
      Record<string, unknown> | undefined;
    if (!compilerOptions) continue;
    const paths = compilerOptions.paths as Record<string, string[]> | undefined;
    if (!paths) continue;

    const rawBaseUrl = compilerOptions.baseUrl as string | undefined;
    // baseUrl is relative to the tsconfig file itself.
    const tsconfigDir = f.path.split("/").slice(0, -1).join("/");
    const baseUrl = normalizeDir(
      rawBaseUrl ? `${tsconfigDir}/${rawBaseUrl}` : tsconfigDir || ".",
    );

    for (const [aliasKey, targetList] of Object.entries(paths)) {
      if (!Array.isArray(targetList)) continue;
      const aliasHasWildcard = aliasKey.includes("*");
      const cleanAlias = aliasKey.replace(/\*$/, "");

      const targets = targetList
        .map((t) => normalizeDir(`${baseUrl}/${t.replace(/\*$/, "")}`))
        .filter((t) => t.length > 0);

      out.push({
        aliasKey: cleanAlias,
        aliasHasWildcard,
        targets,
        baseUrl,
      });
    }
  }

  return out;
}

function normalizeDir(s: string): string {
  const parts = s.split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

/**
 * Try to rewrite an aliased import specifier (e.g. `@/components/Button`)
 * into a relative path (e.g. `src/components/Button`) using the alias map.
 *
 * Returns the rewritten spec, or `null` when no alias matched. Wildcard
 * aliases preserve everything after the `*` join point. Non-wildcard exact
 * matches (`@app` → `src/app`) are also supported.
 */
export function resolveAliasedImport(
  spec: string,
  aliases: TsAliasEntry[],
): string | null {
  for (const alias of aliases) {
    if (!alias.aliasHasWildcard) {
      // Exact alias match.
      if (spec === alias.aliasKey) {
        return alias.targets[0] ?? "";
      }
      continue;
    }
    // Wildcard: alias aliasKey like `@/` matches `@/foo/bar`.
    if (spec.startsWith(alias.aliasKey)) {
      const rest = spec.slice(alias.aliasKey.length);
      // Pick the first target as the base directory.
      const target = alias.targets[0];
      if (!target) continue;
      return rest ? `${target}/${rest}` : target;
    }
  }
  return null;
}

/**
 * Combined resolver: try alias rewrite first, then relative resolution.
 * Returns the resolved file path or null. Used by `buildGraph` after the
 * Tree-sitter / regex extraction produced an `ImportRef`.
 */
export function resolveImportOrAlias(
  fromPath: string,
  spec: string,
  fileSet: Set<string>,
  aliases: TsAliasEntry[],
): string | null {
  // Relative specs go straight to the relative resolver.
  if (spec.startsWith(".") || spec.startsWith("/")) {
    return resolveImport(fromPath, spec, fileSet);
  }
  // Otherwise try aliases.
  const rewritten = resolveAliasedImport(spec, aliases);
  if (rewritten === null) return null;
  // Treat the rewritten spec as repo-root-relative; `resolveImport` already
  // handles leading `/` as repo root.
  return resolveImport(fromPath, "/" + rewritten, fileSet);
}
