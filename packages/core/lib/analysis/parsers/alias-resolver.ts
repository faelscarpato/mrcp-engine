import type { TsAliasEntry } from "./imports.js";

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

export function buildAliasMap(
  files: Array<{ path: string; content?: string }>,
): TsAliasEntry[] {
  const out: TsAliasEntry[] = [];

  for (const f of files) {
    const name = f.path.split("/").pop()?.toLowerCase() ?? "";
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

export function resolveAliasedImport(
  spec: string,
  aliases: TsAliasEntry[],
): string | null {
  for (const alias of aliases) {
    if (!alias.aliasHasWildcard) {
      if (spec === alias.aliasKey) {
        return alias.targets[0] ?? "";
      }
      continue;
    }
    if (spec.startsWith(alias.aliasKey)) {
      const rest = spec.slice(alias.aliasKey.length);
      const target = alias.targets[0];
      if (!target) continue;
      return rest ? `${target}/${rest}` : target;
    }
  }
  return null;
}
