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

import { buildGraph as buildGraphFromSource } from './graph-builder.js';
import { injectSkillAndContract, MRCPInjectedContract } from './mrcp-skill-injector.js';

export interface PipelineAnalysisResult {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  createdAt: number;
  status: 'success' | 'error';
  quality: string;
  nodes: any[];
  edges?: any[];
  hotspots?: any[];
  languages?: Record<string, number>;
  mrcpInjectedContracts?: MRCPInjectedContract[]; // 🚀 O novo campo matador do orquestrador
}

/**
 * Pipeline principal de execução do MRCP-Engine.
 * Orquestra a extração AST e injeta automaticamente as Skills e Contratos de Blindagem
 * para consumo instantâneo e determinístico por qualquer IA.
 */
export async function runAnalysisPipeline(repoUrl: string, rawFiles: Array<{ path: string; content: string }>): Promise<PipelineAnalysisResult> {
  const timestamp = Date.now();
  const urlParts = repoUrl.replace(/\.git$/, '').split('/');
  const repo = urlParts.pop() || 'unknown-repo';
  const owner = urlParts.pop() || 'unknown-owner';

  // 1. Executa a construção do grafo padrão e cálculo de métricas ciclomáticas pelo motor
  const baseGraph = await buildGraphFromSource(rawFiles);

  // 2. Extrai os nós identificados pelo analisador para passarem pela varredura de contratos
  const nodesForInspection = (baseGraph.nodes || []).map((node: any) => ({
    id: node.id,
    label: node.label,
    path: node.path,
    language: node.language || 'TypeScript',
    complexity: node.complexity || 10,
    degree: node.degree || 1
  }));

  // 3. Aplica a varredura e injeta as Skills e Contratos de Blindagem nos hotspots críticos
  const injectedContracts = nodesForInspection
    .filter((node: any) => node.complexity > 50 || node.degree > 25)
    .map((node: any) => injectSkillAndContract(node));

  // 4. Retorna o payload consolidado unindo a topologia matemática e as diretrizes de IA
  return {
    id: `${owner}-${repo}-${timestamp}`,
    repoUrl,
    owner,
    repo,
    branch: 'main',
    createdAt: timestamp,
    status: 'success',
    quality: 'full',
    nodes: baseGraph.nodes,
    edges: baseGraph.edges || [],
    hotspots: (baseGraph as any).hotspots || [],
    languages: baseGraph.languages || {},
    mrcpInjectedContracts: injectedContracts // Entrega mastigada para a IA não precisar supor nada
  };
}

export function parseTargetUrl(
  url: string
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
