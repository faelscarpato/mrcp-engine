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

      // 1-Level Spider: Extract JS and CSS links to map architecture
      const { extractImports } = await import("../parsers/imports.js");
      const imports = extractImports("index.html", html);
      const uniqueUrls = new Set<string>();
      
      for (const imp of imports) {
        if (imp.raw.endsWith(".js") || imp.raw.endsWith(".css") || imp.raw.endsWith(".jsx") || imp.raw.endsWith(".ts")) {
          try {
            const url = new URL(imp.raw, ctx.repoUrl).href;
            uniqueUrls.add(url);
          } catch {
            // ignore invalid urls
          }
        }
      }

      if (uniqueUrls.size > 0) {
        onProgress({ pct: 60, label: `Spidering ${uniqueUrls.size} assets`, sourceId: "website" });
        const fetchPromises = Array.from(uniqueUrls).map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const content = await res.text();
              const urlObj = new URL(url);
              // Clean the path to look like a normal file in the graph
              const path = urlObj.pathname.startsWith("/") ? urlObj.pathname.slice(1) : urlObj.pathname;
              return {
                path: path || "unknown",
                content,
                size: content.length
              };
            }
          } catch {
            return null;
          }
          return null;
        });

        const fetchedFiles = (await Promise.all(fetchPromises)).filter((f) => f !== null) as FileEntry[];
        files.push(...fetchedFiles);
      }

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
