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
exports.processSingleCodeFile = processSingleCodeFile;
const path = __importStar(require("path"));
const ast_extractors_1 = require("./ast-extractors");
const metrics_1 = require("./metrics");
function processSingleCodeFile(ctx) {
    const { filePath, relPath, content, statSize, workspaceRoot, allFilePaths, definedEnvVars, testFileMap, combinedTestContent, securityIssues, envIssues, godModules, allExportedSymbols, allImportedSymbolNames, importGraph } = ctx;
    const ext = path.extname(filePath).toLowerCase();
    const language = (0, ast_extractors_1.getLanguageName)(ext);
    const isTest = testFileMap.has(path.basename(filePath).toLowerCase()) || filePath.includes('test') || filePath.includes('spec');
    // 1. Security & Secrets Scan
    const lines = content.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const lineNum = lineIdx + 1;
        for (const rule of ast_extractors_1.SECRET_RULES) {
            if (rule.regex.test(line)) {
                securityIssues.push({
                    id: `sec-${relPath}-${lineNum}`,
                    file: relPath,
                    line: lineNum,
                    severity: rule.severity,
                    rule: rule.rule,
                    message: rule.msg,
                    remediation: 'Mova para arquivo de configuração protegido ou variável de ambiente'
                });
            }
        }
    }
    // 2. Env Usages Scan
    const envUsages = [];
    const envRegex = /\b(?:process\.env|os\.environ(?:\.get)?|import\.meta\.env)\.([A-Z0-9_]+)\b/g;
    let envMatch;
    while ((envMatch = envRegex.exec(content)) !== null) {
        const varName = envMatch[1];
        const lineNum = content.substring(0, envMatch.index).split('\n').length;
        if (!envUsages.some(u => u.name === varName && u.line === lineNum)) {
            envUsages.push({ name: varName, line: lineNum });
        }
        const isStandardOsVar = ['NODE_ENV', 'PORT', 'CI', 'HOME', 'USERPROFILE', 'APPDATA', 'PATH', 'PWD', 'TEMP', 'TMP'].includes(varName);
        if (!definedEnvVars.has(varName) && !isStandardOsVar) {
            if (!envIssues.some(e => e.file === relPath && e.variableName === varName)) {
                envIssues.push({
                    variableName: varName,
                    file: relPath,
                    line: lineNum,
                    status: 'missing_in_example'
                });
            }
        }
    }
    // 3. AST Symbols & Types
    let fnComplexity = 0;
    let fnCount = 0;
    const symbols = (0, ast_extractors_1.extractTypedAstSymbols)(content, filePath, ext, isTest, testFileMap, combinedTestContent);
    for (const sym of symbols) {
        if (sym.isExported) {
            allExportedSymbols.set(`${relPath}#${sym.name}`, {
                name: sym.name,
                file: relPath,
                line: sym.line,
                kind: sym.kind
            });
        }
        if (sym.kind === 'function' || sym.kind === 'method') {
            fnComplexity += sym.complexity;
            fnCount++;
        }
    }
    // 4. Imports & Exports
    const rawImports = [];
    const rawExports = [];
    const impRegex = /(?:import\s+[\s\S]*?from\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let impMatch;
    while ((impMatch = impRegex.exec(content)) !== null) {
        const spec = impMatch[1] || impMatch[2];
        if (spec && !rawImports.includes(spec))
            rawImports.push(spec);
        const namedSymbolsMatch = impMatch[0].match(/\{([^}]+)\}/);
        if (namedSymbolsMatch && namedSymbolsMatch[1]) {
            namedSymbolsMatch[1].split(',').forEach(s => {
                const clean = s.trim().split(/\s+as\s+/)[0].trim();
                if (clean)
                    allImportedSymbolNames.add(clean);
            });
        }
    }
    const expRegex = /export\s+(?:default\s+)?(?:class|interface|type|function|const|let|enum)\s+([a-zA-Z0-9_$]+)/g;
    let expMatch;
    while ((expMatch = expRegex.exec(content)) !== null) {
        if (expMatch[1] && !rawExports.includes(expMatch[1]))
            rawExports.push(expMatch[1]);
    }
    const imports = (0, metrics_1.resolveImportPaths)(relPath, rawImports, allFilePaths, workspaceRoot);
    importGraph.set(relPath, imports);
    const exports = rawExports;
    // 5. Maintainability Index (MI)
    const fileLoc = lines.length;
    const fileFnComp = symbols.filter(s => s.kind === 'function' || s.kind === 'method').reduce((acc, s) => acc + s.complexity, 0);
    const fileAvgComp = symbols.length > 0 ? Math.max(1, fileFnComp / Math.max(1, symbols.filter(s => s.kind === 'function' || s.kind === 'method').length)) : 1;
    const fileVol = fileLoc * 4.5;
    const rawMI = 171 - 5.2 * Math.log(fileVol) - 0.23 * fileAvgComp - 16.2 * Math.log(fileLoc);
    const fileNormalizedMI = Math.max(20, Math.min(100, Math.round(rawMI * 1.5 + 10)));
    // 6. God Module Detection
    let isGod = false;
    let godReason = '';
    if (fileLoc > 750) {
        isGod = true;
        godReason = `Arquivo monolítico com ${fileLoc} linhas (limite recomendado: 500)`;
    }
    else if (fileLoc > 350 && fileFnComp > 25) {
        isGod = true;
        godReason = `Densidade excessiva de complexidade: ${fileLoc} linhas com complexidade ciclomática acumulada de ${fileFnComp}`;
    }
    else if (symbols.length > 20 && fileLoc > 350) {
        isGod = true;
        godReason = `Excesso de responsabilidades: ${symbols.length} símbolos declarados em ${fileLoc} linhas`;
    }
    if (isGod) {
        godModules.push({
            file: relPath,
            linesCount: fileLoc,
            complexity: fileFnComp,
            reason: godReason
        });
    }
    return {
        analysis: {
            path: filePath,
            relativePath: relPath,
            size: statSize,
            language,
            linesCount: lines.length,
            complexity: Math.round(fileAvgComp * 10) / 10,
            isGodModule: isGod,
            godModuleReason: godReason,
            symbols,
            imports,
            exports,
            envUsages,
            securityIssues: securityIssues.filter(s => s.file === relPath)
        },
        fileNormalizedMI,
        fnComplexity,
        fnCount
    };
}
//# sourceMappingURL=file-processor.js.map