import type { Analysis, AnalysisSourceId } from "@/lib/graph-types";
import type {
  AnalysisContext,
  AnalysisResult,
  AnalysisSource,
  ProgressEvent,
} from "./types.js";
import { githubApiSource } from "./sources/github-api.js";
import { deterministicSource } from "./sources/deterministic.js";
import { localDirSource } from "./sources/local-dir.js";
import { websiteSource } from "./sources/website.js";
import { computeMetrics } from "./graph-builder.js";

export function parseTargetUrl(
  url: string,
): { owner: string; repo: string; targetType: "github" | "local" | "website" } | null {
  const trimmed = url.trim();
  
  if (trimmed.match(/^[a-zA-Z]:\\/) || trimmed.match(/^[a-zA-Z]:\//) || trimmed.startsWith("/")) {
    const parts = trimmed.replace(/\\/g, "/").split("/");
    const repo = parts[parts.length - 1] || "local-project";
    return { owner: "local", repo, targetType: "local" };
  }
  
  try {
    const u = new URL(trimmed);
    if (u.protocol === "file:") {
      const parts = u.pathname.split("/");
      const repo = parts[parts.length - 1] || "local-project";
      return { owner: "local", repo, targetType: "local" };
    }
    
    if (/github\.com$/i.test(u.hostname)) {
      const [owner, repoRaw] = u.pathname.replace(/^\//, "").split("/");
      if (!owner || !repoRaw) return null;
      return { owner, repo: repoRaw.replace(/\.git$/, ""), targetType: "github" };
    }
    
    if (u.protocol === "http:" || u.protocol === "https:") {
      return { owner: "web", repo: u.hostname, targetType: "website" };
    }
    
    return null;
  } catch {
    return null;
  }
}

const DEFAULT_ORDER: AnalysisSource[] = [githubApiSource, localDirSource, websiteSource, deterministicSource];

export interface RunOptions {
  repoUrl: string;
  branch?: string;
  githubToken?: string;
  maxFiles?: number;
  maxBytesPerFile?: number;
  onProgress?: (p: ProgressEvent) => void;
  sources?: AnalysisSource[];
}

export async function runAnalysis(opts: RunOptions): Promise<AnalysisResult> {
  const parsed = parseTargetUrl(opts.repoUrl);
  if (!parsed) throw new Error("Invalid target URL or path.");
  const ctx: AnalysisContext = {
    owner: parsed.owner,
    repo: parsed.repo,
    branch: opts.branch?.trim() || "main",
    repoUrl: opts.repoUrl,
    targetType: parsed.targetType,
    githubToken: opts.githubToken,
    maxFiles: opts.maxFiles ?? 1900,
    maxBytesPerFile: opts.maxBytesPerFile ?? 200_000,
  };
  const onProgress = opts.onProgress ?? (() => { });
  const attempted: Array<{
    id: AnalysisSourceId;
    ok: boolean;
    reason?: string;
  }> = [];
  const sources = opts.sources ?? DEFAULT_ORDER;

  for (const src of sources) {
    try {
      const can = await src.canRun(ctx);
      if (!can) {
        attempted.push({ id: src.id, ok: false, reason: "not applicable" });
        continue;
      }
      onProgress({ pct: 4, label: `Trying ${src.id}`, sourceId: src.id });
      const partial = await src.run(ctx, onProgress);
      attempted.push({ id: src.id, ok: true });
      const metrics = computeMetrics(
        partial.nodes,
        partial.edges,
        partial.languages,
      );
      metrics.warnings = partial.warnings ?? [];
      metrics.moduleMetrics = partial.moduleMetrics;
      metrics.cycles = partial.cycles;
      metrics.godModules = partial.godModules;
      const status: Analysis["status"] =
        partial.quality === "full"
          ? "success"
          : partial.quality === "partial"
            ? "partial"
            : "partial";
      const analysis: Analysis = {
        id: `${ctx.owner}-${ctx.repo}-${ctx.branch}-${Date.now()}`,
        repoUrl: ctx.repoUrl,
        owner: ctx.owner,
        repo: ctx.repo,
        branch: ctx.branch,
        createdAt: Date.now(),
        status,
        quality: partial.quality,
        sourceUsed: src.id,
        attempted,
        limitations: partial.limitations ?? [],
        nodes: partial.nodes,
        edges: partial.edges,
        metrics,
        monorepoTool: partial.monorepo?.tool,
        monorepoRoots: partial.monorepoRoots,
      };
      onProgress({ pct: 100, label: "Analysis complete", sourceId: src.id });
      return { analysis, attempted };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown error";
      attempted.push({ id: src.id, ok: false, reason });
      onProgress({
        pct: 4,
        label: `${src.id} failed — falling back`,
        sourceId: src.id,
      });
    }
  }
  throw new Error("All analysis sources failed.");
}
