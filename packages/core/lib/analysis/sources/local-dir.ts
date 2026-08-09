import type { AnalysisSource, AnalysisContext, PartialAnalysis, ProgressEvent } from "../types.js";
import { buildGraph, type FileEntry } from "../graph-builder.js";
import { isSourceFile, isConfigFile } from "../parsers/language.js";
import * as fs from "fs";
import * as path from "path";

async function walkDir(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = await fs.promises.readdir(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".git" || file === "dist" || file === "build") continue;
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      await walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export const localDirSource: AnalysisSource = {
  id: "local-dir",
  canRun(ctx: AnalysisContext): boolean {
    return ctx.targetType === "local";
  },
  async run(ctx: AnalysisContext, onProgress: (p: ProgressEvent) => void): Promise<PartialAnalysis> {
    const maxFiles = ctx.maxFiles ?? 1900;
    const maxBytes = ctx.maxBytesPerFile ?? 200_000;
    
    // Convert file:// if needed or use raw path
    let targetPath = ctx.repoUrl;
    if (targetPath.startsWith("file://")) {
      targetPath = new URL(targetPath).pathname;
      // Handle windows drive letter from URL (e.g., /C:/...)
      if (process.platform === "win32" && targetPath.match(/^\/[a-zA-Z]:/)) {
        targetPath = targetPath.substring(1);
      }
    }

    onProgress({ pct: 10, label: "Scanning local directory", sourceId: "local-dir" });
    
    let allFiles: string[] = [];
    try {
      allFiles = await walkDir(targetPath);
    } catch (e) {
      throw new Error(`Failed to read local directory: ${e instanceof Error ? e.message : String(e)}`);
    }

    const sourceItems = allFiles
      .filter((p) => {
        // Convert back to posix for check
        const posixPath = p.split(path.sep).join("/");
        return isSourceFile(posixPath) || isConfigFile(posixPath);
      });

    const capped = sourceItems.slice(0, maxFiles);
    
    onProgress({ pct: 30, label: `Reading ${capped.length} files`, sourceId: "local-dir" });
    
    const files: FileEntry[] = [];
    const limitations: string[] = [];
    if (sourceItems.length > maxFiles) {
      limitations.push(`Analyzed ${maxFiles} of ${sourceItems.length} source files (cap).`);
    }

    let done = 0;
    for (const item of capped) {
      try {
        const stat = await fs.promises.stat(item);
        if (stat.size <= maxBytes) {
          const content = await fs.promises.readFile(item, "utf-8");
          // Convert absolute to relative path for the graph
          const relPath = path.relative(targetPath, item).split(path.sep).join("/");
          files.push({ path: relPath, content, size: stat.size });
        }
      } catch (e) {
        // Ignore files that fail to read
      }
      done++;
      if (done % 50 === 0 || done === capped.length) {
        const pct = 30 + Math.floor((done / capped.length) * 50);
        onProgress({ pct, label: `Parsing local sources (${done}/${capped.length})`, sourceId: "local-dir" });
      }
    }

    onProgress({ pct: 88, label: "Building dependency graph", sourceId: "local-dir" });
    const partial = await buildGraph(files);
    partial.limitations = [...(partial.limitations ?? []), ...limitations];
    partial.quality = sourceItems.length > maxFiles ? "partial" : "full";

    onProgress({ pct: 100, label: "Computing metrics", sourceId: "local-dir" });
    return partial;
  },
};
