import type {
  Analysis,
  AnalysisQuality,
  AnalysisSourceId,
  GraphEdge,
  GraphNode,
  AdvancedModuleMetrics,
  Cycle,
} from "@/lib/graph-types";
import type { MonorepoConfig } from "./parsers/language";

export interface AnalysisContext {
  owner: string;
  repo: string;
  branch: string;
  repoUrl: string;
  githubToken?: string;
  maxFiles?: number;
  maxBytesPerFile?: number;
}

export interface ProgressEvent {
  pct: number;
  label: string;
  step?: string;
  sourceId?: AnalysisSourceId;
}

export interface PartialAnalysis {
  nodes: GraphNode[];
  edges: GraphEdge[];
  languages?: Record<string, number>;
  warnings?: string[];
  limitations?: string[];
  quality: AnalysisQuality;
  monorepo?: MonorepoConfig;
  monorepoRoots?: string[];
  /** Sprint 4: advanced architecture metrics */
  moduleMetrics?: AdvancedModuleMetrics[];
  cycles?: Cycle[];
  godModules?: string[];
}

export interface AnalysisSource {
  id: AnalysisSourceId;
  canRun(ctx: AnalysisContext): Promise<boolean> | boolean;
  run(
    ctx: AnalysisContext,
    onProgress: (p: ProgressEvent) => void,
  ): Promise<PartialAnalysis>;
}

export interface AnalysisResult {
  analysis: Analysis;
  attempted: Array<{ id: AnalysisSourceId; ok: boolean; reason?: string }>;
}
