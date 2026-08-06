import type { AnalysisSource, AnalysisContext, PartialAnalysis, ProgressEvent } from "../types.js";
import { buildGraph, type FileEntry } from "../graph-builder.js";

export const websiteSource: AnalysisSource = {
  id: "website",
  canRun(ctx: AnalysisContext): boolean {
    return ctx.targetType === "website";
  },
  async run(ctx: AnalysisContext, onProgress: (p: ProgressEvent) => void): Promise<PartialAnalysis> {
    onProgress({ pct: 10, label: "Fetching website content", sourceId: "website" });
    
    try {
      const response = await fetch(ctx.repoUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();
      
      onProgress({ pct: 50, label: "Parsing HTML structure", sourceId: "website" });
      
      const files: FileEntry[] = [
        {
          path: "index.html",
          content: html,
          size: html.length
        }
      ];

      onProgress({ pct: 88, label: "Building HTML graph", sourceId: "website" });
      const partial = await buildGraph(files);
      partial.quality = "full";
      
      onProgress({ pct: 100, label: "Analysis complete", sourceId: "website" });
      return partial;
    } catch (e) {
      throw new Error(`Failed to parse website: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
};
