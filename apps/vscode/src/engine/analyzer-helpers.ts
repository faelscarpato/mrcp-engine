import * as fs from 'fs';
import * as path from 'path';
import { MrcpDeadCodeItem, MrcpDocItem, MrcpTestGap, MrcpFileAnalysis } from './types';

export const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next', '.turbo', 'coverage', '.gemini', '.cache', '.vercel', 'vendor', 'obj', '.output', 'temp', 'tmp'
]);

export async function scanDir(root: string, currentDir: string, result: string[], maxFiles: number): Promise<void> {
  if (result.length >= maxFiles) return;
  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= maxFiles) break;
      if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.env.example') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(root, fullPath, result, maxFiles);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  } catch {}
}

export function processDocumentFiles(workspaceRoot: string, docFiles: string[]): MrcpDocItem[] {
  const docItems: MrcpDocItem[] = [];
  for (const docPath of docFiles) {
    const relPath = path.relative(workspaceRoot, docPath).replace(/\\/g, '/');
    try {
      const stat = fs.statSync(docPath);
      if (stat.size > 2_000_000) continue;
      const ext = path.extname(docPath).toLowerCase().replace('.', '');
      let wordCount = 0;
      let quality = 85;

      if (['md', 'txt', 'csv', 'json', 'yaml', 'yml', 'log'].includes(ext)) {
        const text = fs.readFileSync(docPath, 'utf8');
        wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < 10) quality = 40;
        else if (wordCount > 500) quality = 95;
      } else {
        wordCount = Math.floor(stat.size / 6);
        quality = 90;
      }

      docItems.push({
        file: relPath,
        format: ext.toUpperCase(),
        size: stat.size,
        wordCount,
        qualityScore: quality
      });
    } catch {}
  }
  return docItems;
}

export function detectDeadCode(
  workspaceRoot: string,
  allExportedSymbols: Map<string, { file: string; name: string; kind: string; line: number }>,
  allImportedSymbolNames: Set<string>,
  fileContentsMap: Map<string, string>
): MrcpDeadCodeItem[] {
  const deadCodeItems: MrcpDeadCodeItem[] = [];
  for (const [, item] of allExportedSymbols.entries()) {
    const relPath = item.file;
    const symName = item.name;

    const isPublicModule = relPath.startsWith('packages/core/lib/') ||
                           relPath.startsWith('api/') ||
                           relPath.startsWith('bin/') ||
                           relPath.includes('index.') ||
                           relPath.includes('extension.') ||
                           relPath.includes('types.') ||
                           relPath.startsWith('apps/vscode/src/providers/');

    if (isPublicModule) continue;
    if (allImportedSymbolNames.has(symName)) continue;

    let hasReference = false;
    const wordRegex = new RegExp(`\\b${symName}\\b`, 'g');
    const selfContent = fileContentsMap.get(path.resolve(workspaceRoot, relPath)) || '';
    const selfOccurrences = (selfContent.match(wordRegex) || []).length;
    if (selfOccurrences > 1) hasReference = true;

    if (!hasReference) {
      for (const [otherPath, otherContent] of fileContentsMap.entries()) {
        const otherRel = path.relative(workspaceRoot, otherPath).replace(/\\/g, '/');
        if (otherRel === relPath) continue;
        if (wordRegex.test(otherContent)) {
          hasReference = true;
          break;
        }
      }
    }

    if (!hasReference) {
      deadCodeItems.push({
        file: relPath,
        symbolName: symName,
        kind: item.kind,
        line: item.line,
        reason: 'Símbolo exportado sem import ou referência cruzada no workspace'
      });
    }
  }
  return deadCodeItems;
}

export function detectTestGaps(analyzedFiles: MrcpFileAnalysis[]): MrcpTestGap[] {
  const testGaps: MrcpTestGap[] = [];
  for (const file of analyzedFiles) {
    if (file.relativePath.includes('test') || file.relativePath.includes('spec') || file.relativePath.includes('__tests__')) continue;
    for (const sym of file.symbols) {
      if (sym.isExported && sym.complexity >= 5 && !sym.hasTests) {
        testGaps.push({
          file: file.relativePath,
          functionName: sym.name,
          line: sym.line,
          type: sym.kind,
          complexity: sym.complexity
        });
      }
    }
  }
  return testGaps;
}
