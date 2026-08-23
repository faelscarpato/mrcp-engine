"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IGNORED_DIRS = void 0;
exports.scanDir = scanDir;
exports.processDocumentFiles = processDocumentFiles;
exports.detectDeadCode = detectDeadCode;
exports.detectTestGaps = detectTestGaps;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'out', 'build', '.next', '.turbo', 'coverage', '.gemini', '.cache'
]);
async function scanDir(root, currentDir, result, maxFiles) {
    if (result.length >= maxFiles)
        return;
    try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (result.length >= maxFiles)
                break;
            if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.env.example')
                continue;
            if (exports.IGNORED_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await scanDir(root, fullPath, result, maxFiles);
            }
            else if (entry.isFile()) {
                result.push(fullPath);
            }
        }
    }
    catch { }
}
function processDocumentFiles(workspaceRoot, docFiles) {
    const docItems = [];
    for (const docPath of docFiles) {
        const relPath = path.relative(workspaceRoot, docPath).replace(/\\/g, '/');
        try {
            const stat = fs.statSync(docPath);
            if (stat.size > 2_000_000)
                continue;
            const ext = path.extname(docPath).toLowerCase().replace('.', '');
            let wordCount = 0;
            let quality = 85;
            if (['md', 'txt', 'csv', 'json', 'yaml', 'yml', 'log'].includes(ext)) {
                const text = fs.readFileSync(docPath, 'utf8');
                wordCount = text.split(/\s+/).filter(Boolean).length;
                if (wordCount < 10)
                    quality = 40;
                else if (wordCount > 500)
                    quality = 95;
            }
            else {
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
        }
        catch { }
    }
    return docItems;
}
function detectDeadCode(workspaceRoot, allExportedSymbols, allImportedSymbolNames, fileContentsMap) {
    const deadCodeItems = [];
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
        if (isPublicModule)
            continue;
        if (allImportedSymbolNames.has(symName))
            continue;
        let hasReference = false;
        const wordRegex = new RegExp(`\\b${symName}\\b`, 'g');
        const selfContent = fileContentsMap.get(path.resolve(workspaceRoot, relPath)) || '';
        const selfOccurrences = (selfContent.match(wordRegex) || []).length;
        if (selfOccurrences > 1)
            hasReference = true;
        if (!hasReference) {
            for (const [otherPath, otherContent] of fileContentsMap.entries()) {
                const otherRel = path.relative(workspaceRoot, otherPath).replace(/\\/g, '/');
                if (otherRel === relPath)
                    continue;
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
function detectTestGaps(analyzedFiles) {
    const testGaps = [];
    for (const file of analyzedFiles) {
        if (file.relativePath.includes('test') || file.relativePath.includes('spec') || file.relativePath.includes('__tests__'))
            continue;
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
//# sourceMappingURL=analyzer-helpers.js.map