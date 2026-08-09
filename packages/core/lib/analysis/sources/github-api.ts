import type {
  AnalysisSource,
  PartialAnalysis,
  ProgressEvent,
  AnalysisContext,
} from "../types.js";
import { buildGraph, type FileEntry } from "../graph-builder.js";
import { isSourceFile, isConfigFile } from "../parsers/language.js";

const API = "https://api.github.com";

interface TreeItem {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha: string;
}

async function ghFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

async function resolveBranch(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<string> {
  if (branch && branch !== "auto") return branch;
  const r = await ghFetch(`${API}/repos/${owner}/${repo}`, token);
  if (!r.ok) throw new Error(`Repo not found or inaccessible (${r.status}).`);
  const data = await r.json();
  return data.default_branch ?? "main";
}

export const githubApiSource: AnalysisSource = {
  id: "github-api",
  async canRun() {
    return true;
  },
  async run(
    ctx: AnalysisContext,
    onProgress: (p: ProgressEvent) => void,
  ): Promise<PartialAnalysis> {
    const { owner, repo, githubToken } = ctx;
    const maxFiles = ctx.maxFiles ?? 1900;
    const maxBytes = ctx.maxBytesPerFile ?? 200_000;

    onProgress({ pct: 8, label: "Resolving branch", sourceId: "github-api" });
    const branch = await resolveBranch(owner, repo, ctx.branch, githubToken);

    onProgress({
      pct: 18,
      label: "Fetching repository tree",
      sourceId: "github-api",
    });
    const treeRes = await ghFetch(
      `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      githubToken,
    );
    if (!treeRes.ok) {
      if (treeRes.status === 403)
        throw new Error(
          "GitHub rate limit exceeded. Add a token in Settings to raise the limit.",
        );
      if (treeRes.status === 404)
        throw new Error("Repository or branch not found.");
      throw new Error(`GitHub tree request failed (${treeRes.status}).`);
    }
    const treeData = await treeRes.json();
    const items: TreeItem[] = treeData.tree ?? [];
    const truncated = !!treeData.truncated;

    const sourceItems = items
      .filter((i) => i.type === "blob")
      .filter((i) => isSourceFile(i.path) || isConfigFile(i.path))
      .filter((i) => (i.size ?? 0) <= maxBytes);

    // Prioritize: entrypoint-like paths + shallow depth first
    sourceItems.sort((a, b) => {
      const depthA = a.path.split("/").length;
      const depthB = b.path.split("/").length;
      return depthA - depthB;
    });
    const capped = sourceItems.slice(0, maxFiles);

    onProgress({
      pct: 32,
      label: `Fetching ${capped.length} files`,
      sourceId: "github-api",
    });

    const files: FileEntry[] = [];
    const warnings: string[] = [];
    const limitations: string[] = [];

    if (truncated)
      limitations.push(
        "Repository tree was truncated by GitHub (very large repo).",
      );
    if (sourceItems.length > maxFiles) {
      limitations.push(
        `Analyzed ${maxFiles} of ${sourceItems.length} source files (cap).`,
      );
    }

    let done = 0;
    const CONCURRENCY = 8;
    let cursor = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < capped.length) {
        const idx = cursor++;
        const item = capped[idx];
        try {
          const raw = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`,
          );
          if (raw.ok) {
            const content = await raw.text();
            files.push({ path: item.path, content, size: item.size });
          } else {
            files.push({ path: item.path, size: item.size });
            warnings.push(`Could not read ${item.path} (${raw.status}).`);
          }
        } catch (e) {
          files.push({ path: item.path, size: item.size });
          warnings.push(`Fetch failed for ${item.path}.`);
        }
        done++;
        if (done % 5 === 0 || done === capped.length) {
          const pct = 32 + Math.floor((done / capped.length) * 50);
          onProgress({
            pct,
            label: `Parsing sources (${done}/${capped.length})`,
            sourceId: "github-api",
          });
        }
      }
    });
    await Promise.all(workers);

    onProgress({
      pct: 88,
      label: "Building dependency graph",
      sourceId: "github-api",
    });
    const partial = await buildGraph(files);
    partial.warnings = [...(partial.warnings ?? []), ...warnings.slice(0, 5)];
    if (warnings.length > 5)
      partial.warnings.push(`+${warnings.length - 5} more file read errors.`);
    partial.limitations = [...(partial.limitations ?? []), ...limitations];
    partial.quality =
      truncated || sourceItems.length > maxFiles ? "partial" : "full";

    onProgress({ pct: 96, label: "Computing metrics", sourceId: "github-api" });
    return partial;
  },
};
