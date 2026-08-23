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
exports.detectDuplicateModules = detectDuplicateModules;
exports.resolveImportPaths = resolveImportPaths;
exports.findCycles = findCycles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function detectDuplicateModules(workspaceRoot) {
    const duplicates = [];
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
        }
        catch { }
    }
    return duplicates;
}
function resolveImportPaths(file, rawImports, allFiles, root) {
    const resolved = [];
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
function findCycles(graph) {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();
    const pathStack = [];
    function dfs(node) {
        visited.add(node);
        recStack.add(node);
        pathStack.push(node);
        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            }
            else if (recStack.has(neighbor)) {
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
//# sourceMappingURL=metrics.js.map