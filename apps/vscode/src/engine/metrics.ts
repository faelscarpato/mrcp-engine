import * as fs from 'fs';
import * as path from 'path';
import { MrcpDuplicateModule, MrcpDependencyCycle } from './types';

export function detectDuplicateModules(workspaceRoot: string): MrcpDuplicateModule[] {
  const duplicates: MrcpDuplicateModule[] = [];
  const srcAnalysisDir = path.join(workspaceRoot, 'src/lib/analysis');
  const coreAnalysisDir = path.join(workspaceRoot, 'packages/core/lib/analysis');

  if (fs.existsSync(srcAnalysisDir) && fs.existsSync(coreAnalysisDir)) {
    try {
      const srcFiles = fs.readdirSync(srcAnalysisDir);
      for (const file of srcFiles) {
        const srcFilePath = path.join(srcAnalysisDir, file);
        const coreFilePath = path.join(coreAnalysisDir, file);

        if (fs.existsSync(coreFilePath) && fs.statSync(srcFilePath).isFile()) {
          const srcContent = fs.readFileSync(srcFilePath, 'utf8');
          const coreContent = fs.readFileSync(coreFilePath, 'utf8');
          const isReexport = srcContent.includes('export * from');
          const equivalent = srcContent === coreContent || isReexport;

          duplicates.push({
            primary: `packages/core/lib/analysis/${file}`,
            duplicate: `src/lib/analysis/${file}`,
            contentEquivalent: equivalent,
            risk: equivalent ? 'low' : 'high'
          });
        }
      }
    } catch {}
  }

  return duplicates;
}

export function resolveImportPaths(file: string, rawImports: string[], allFiles: string[], root: string): string[] {
  const resolved: string[] = [];
  const currentDir = path.dirname(path.join(root, file));

  for (const imp of rawImports) {
    if (imp.startsWith('.')) {
      const absTarget = path.resolve(currentDir, imp);
      for (const f of allFiles) {
        const fNoExt = f.replace(/\.[^/.]+$/, '');
        if (f === absTarget || fNoExt === absTarget) {
          resolved.push(path.relative(root, f).replace(/\\/g, '/'));
          break;
        }
      }
    }
  }
  return resolved;
}

export function findCycles(graph: Map<string, string[]>): MrcpDependencyCycle[] {
  const cycles: MrcpDependencyCycle[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const pathStack: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    recStack.add(node);
    pathStack.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = pathStack.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cyclePath = pathStack.slice(cycleStartIndex);
          cyclePath.push(neighbor);
          if (cyclePath.length > 2) {
            cycles.push({
              files: cyclePath,
              length: cyclePath.length - 1
            });
          }
        }
      }
    }

    pathStack.pop();
    recStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles.slice(0, 10);
}
