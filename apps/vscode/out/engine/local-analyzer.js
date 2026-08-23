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
exports.analyzeWorkspaceLocally = analyzeWorkspaceLocally;
exports.extractTypedAstSymbols = extractTypedAstSymbols;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'out',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '.gemini',
    '.cache'
]);
const CODE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.c', '.cpp',
    '.php', '.rb', '.cs',
    '.cds', '.abap', '.clas', '.intf', '.prog',
    '.sql', '.pls', '.pks', '.pkb', '.pck', '.plb', '.trg', '.fnc', '.prc',
    '.pas', '.pp', '.inc', '.cbl', '.cob', '.cpy'
]);
const DOC_EXTENSIONS = new Set([
    '.md', '.txt', '.csv', '.json', '.yaml', '.yml',
    '.docx', '.pdf', '.xlsx', '.log'
]);
const SECRET_RULES = [
    { rule: 'AWS Key', regex: /(?:AKIA|ASIA)[0-9A-Z]{16}/, severity: 'critical', msg: 'Hardcoded AWS Access Key detected.' },
    { rule: 'Generic Private Key', regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/, severity: 'critical', msg: 'Private cryptographic key exposed in source.' },
    { rule: 'GitHub Token', regex: /gh[pousr]_[0-9a-zA-Z]{36}/, severity: 'critical', msg: 'GitHub Personal/OAuth Token detected.' },
    { rule: 'Hardcoded JWT', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, severity: 'high', msg: 'Hardcoded JSON Web Token (JWT) detected.' },
    { rule: 'Dangerous Eval', regex: /(?<![\/\*a-zA-Z0-9_])eval\s*\([^)]+\)/, severity: 'high', msg: 'Arbitrary code execution risk with eval().' },
    { rule: 'Hardcoded Password/Secret', regex: /(?:password|secret|apiKey|api_key|authToken)\s*[:=]\s*["'][a-zA-Z0-9_\-!@#$%^&*]{16,}["']/i, severity: 'medium', msg: 'Possible hardcoded credential or secret.' }
];
async function analyzeWorkspaceLocally(workspaceRoot, maxFiles = 2000, onProgress) {
    const startTime = Date.now();
    onProgress?.(5, 'Escaneando estrutura do workspace...');
    const allFilePaths = [];
    await scanDir(workspaceRoot, workspaceRoot, allFilePaths, maxFiles);
    const codeFiles = allFilePaths.filter(f => CODE_EXTENSIONS.has(path.extname(f).toLowerCase()));
    const docFiles = allFilePaths.filter(f => DOC_EXTENSIONS.has(path.extname(f).toLowerCase()));
    // 1. Read defined .env variables
    const definedEnvVars = new Set();
    const envFileCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];
    for (const envFile of envFileCandidates) {
        const envPath = path.join(workspaceRoot, envFile);
        if (fs.existsSync(envPath)) {
            try {
                const content = fs.readFileSync(envPath, 'utf8');
                for (const line of content.split('\n')) {
                    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/i);
                    if (match && match[1]) {
                        definedEnvVars.add(match[1]);
                    }
                }
            }
            catch { }
        }
    }
    // Pre-load all test files and all workspace code for cross-referencing
    const testFileMap = new Set();
    const allTestFilesContent = [];
    const fileContentsMap = new Map();
    for (const f of allFilePaths) {
        const base = path.basename(f).toLowerCase();
        if (base.includes('.test.') || base.includes('.spec.') || base.startsWith('test_') || f.includes('/tests/') || f.includes('/__tests__/')) {
            testFileMap.add(base);
            testFileMap.add(base.replace(/(\.test|\.spec)/, ''));
            try {
                allTestFilesContent.push(fs.readFileSync(f, 'utf8'));
            }
            catch { }
        }
        if (CODE_EXTENSIONS.has(path.extname(f).toLowerCase())) {
            try {
                fileContentsMap.set(f, fs.readFileSync(f, 'utf8'));
            }
            catch { }
        }
    }
    const combinedTestContent = allTestFilesContent.join('\n');
    const analyzedFiles = [];
    const securityIssues = [];
    const envIssues = [];
    const apiRoutes = [];
    const docItems = [];
    const godModules = [];
    const importGraph = new Map();
    const allExportedSymbols = new Map();
    const allImportedSymbolNames = new Set();
    let totalLinesOfCode = 0;
    let totalRawBytes = 0;
    let totalFunctionCount = 0;
    let totalFunctionComplexity = 0;
    let totalFileMI = 0;
    const hasher = crypto.createHash('sha256');
    // Pre-pass: Collect all single-line & multi-line imported symbol names across all files
    for (const [filePath, content] of fileContentsMap.entries()) {
        const importBlockRegex = /import\s+(?:type\s+)?(?:\{([\s\S]*?)\}|\*\s+as\s+([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+)(?:\s*,\s*\{([\s\S]*?)\})?)\s+from\s+['"]([^'"]+)['"]/g;
        let impMatch;
        while ((impMatch = importBlockRegex.exec(content)) !== null) {
            if (impMatch[1]) {
                impMatch[1].split(',').forEach(s => {
                    const cleaned = s.replace(/type\s+/, '').trim().split(/\s+as\s+/)[0].trim();
                    if (cleaned)
                        allImportedSymbolNames.add(cleaned);
                });
            }
            if (impMatch[2])
                allImportedSymbolNames.add(impMatch[2].trim());
            if (impMatch[3])
                allImportedSymbolNames.add(impMatch[3].trim());
            if (impMatch[4]) {
                impMatch[4].split(',').forEach(s => {
                    const cleaned = s.replace(/type\s+/, '').trim().split(/\s+as\s+/)[0].trim();
                    if (cleaned)
                        allImportedSymbolNames.add(cleaned);
                });
            }
        }
    }
    // Pass 1: Process code files with AST Extraction
    for (let i = 0; i < codeFiles.length; i++) {
        const filePath = codeFiles[i];
        const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        const content = fileContentsMap.get(filePath) || '';
        if (i % 20 === 0 && onProgress) {
            const pct = 10 + Math.floor((i / codeFiles.length) * 60);
            onProgress(pct, `Analisando AST & Contratos (${i + 1}/${codeFiles.length}): ${path.basename(relPath)}`);
        }
        try {
            const stat = fs.statSync(filePath);
            if (stat.size > 1_200_000)
                continue;
            totalRawBytes += stat.size;
            hasher.update(relPath + ':' + stat.mtimeMs);
            const lines = content.split('\n');
            totalLinesOfCode += lines.length;
            const fileExt = path.extname(filePath).toLowerCase();
            const language = getLanguageName(fileExt);
            const isTestFile = relPath.includes('test') || relPath.includes('spec') || relPath.includes('__tests__') || relPath.includes('/tests/');
            const isSecurityScannerFile = relPath.includes('security-audit') || relPath.includes('local-analyzer');
            // Extract high-fidelity typed AST symbols
            const symbols = extractTypedAstSymbols(content, relPath, fileExt, isTestFile, testFileMap, combinedTestContent);
            for (const sym of symbols) {
                if (sym.kind === 'function' || sym.kind === 'method') {
                    totalFunctionCount++;
                    totalFunctionComplexity += sym.complexity;
                }
                if (sym.isExported) {
                    allExportedSymbols.set(`${relPath}#${sym.name}`, { file: relPath, line: sym.line, kind: sym.kind, name: sym.name });
                }
            }
            // Extract imports and process.env
            const imports = [];
            const exports = symbols.filter(s => s.isExported).map(s => s.name);
            const envUsages = [];
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                const line = lines[lineIdx];
                const lineNum = lineIdx + 1;
                const trimmed = line.trim();
                // Process.env
                const envMatch = line.match(/process\.env\.([A-Z0-9_]+)/g) || line.match(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g);
                if (envMatch) {
                    for (const raw of envMatch) {
                        const varName = raw.replace(/process\.env\.|process\.env\[['"]|['"]\]/g, '');
                        if (varName && !['NODE_ENV', 'PORT'].includes(varName)) {
                            envUsages.push({ name: varName, line: lineNum });
                            if (definedEnvVars.size > 0 && !definedEnvVars.has(varName)) {
                                envIssues.push({
                                    variableName: varName,
                                    file: relPath,
                                    line: lineNum,
                                    status: 'missing_in_env'
                                });
                            }
                        }
                    }
                }
                // Security Patterns
                if (!isSecurityScannerFile && !isTestFile && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
                    for (const sec of SECRET_RULES) {
                        if (trimmed.includes('regex:') || trimmed.includes('RegExp('))
                            continue;
                        if (sec.regex.test(line)) {
                            if (line.includes('example') || line.includes('placeholder') || line.includes('mock') || line.includes('test'))
                                continue;
                            securityIssues.push({
                                id: `sec-${relPath}-${lineNum}-${sec.rule.replace(/\s+/g, '-').toLowerCase()}`,
                                rule: sec.rule,
                                severity: sec.severity,
                                message: sec.msg,
                                file: relPath,
                                line: lineNum,
                                remediation: 'Mova chaves sensíveis e credenciais para variáveis de ambiente protegidas (.env).'
                            });
                        }
                    }
                }
            }
            // Collect raw imports for dependency graph
            const rawImportMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
            for (const m of rawImportMatches) {
                if (m[1])
                    imports.push(m[1]);
            }
            importGraph.set(relPath, resolveImportPaths(relPath, imports, codeFiles, workspaceRoot));
            // Calculate Per-File Maintainability Index
            const fileLoc = Math.max(1, lines.length);
            const fileFnComp = symbols.filter(s => s.kind === 'function' || s.kind === 'method').reduce((acc, s) => acc + s.complexity, 0);
            const fileAvgComp = symbols.length > 0 ? Math.max(1, fileFnComp / Math.max(1, symbols.filter(s => s.kind === 'function' || s.kind === 'method').length)) : 1;
            const fileVol = fileLoc * 4.5;
            const rawMI = 171 - 5.2 * Math.log(fileVol) - 0.23 * fileAvgComp - 16.2 * Math.log(fileLoc);
            const fileNormalizedMI = Math.max(20, Math.min(100, Math.round(rawMI * 1.5 + 10)));
            totalFileMI += fileNormalizedMI;
            // God Module Detection: Standard Criteria (LOC > 500 OR (LOC > 300 AND complexity > 25) OR (symbols > 20 AND LOC > 350))
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
            analyzedFiles.push({
                path: filePath,
                relativePath: relPath,
                size: stat.size,
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
            });
        }
        catch { }
    }
    // 2. Extract Complete HTTP Routes & Aliases with Real Method breakdown
    onProgress?.(70, 'Extraindo contratos HTTP e métodos de despacho...');
    extractApiRoutes(workspaceRoot, codeFiles, apiRoutes);
    // 3. Process Document Files (MD, CSV, PDF, TXT, etc.)
    onProgress?.(75, 'Analisando inteligência documental & DQI...');
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
    // 4. Detect Dependency Cycles
    onProgress?.(85, 'Detectando ciclos e duplicação entre módulos...');
    const dependencyCycles = findCycles(importGraph);
    // 5. Detect Parallel Duplications between src and packages/core
    const duplicateModules = detectDuplicateModules(workspaceRoot);
    // 6. Detect True Dead Code (Strict Cross-File Reference Check)
    const deadCodeItems = [];
    for (const [key, item] of allExportedSymbols.entries()) {
        const relPath = item.file;
        const symName = item.name;
        // Exempt public entrypoints, packages library roots, CLI binaries, API handlers and VS Code providers
        const isPublicModule = relPath.startsWith('packages/core/lib/') ||
            relPath.startsWith('api/') ||
            relPath.startsWith('bin/') ||
            relPath.includes('index.') ||
            relPath.includes('extension.') ||
            relPath.includes('types.') ||
            relPath.startsWith('apps/vscode/src/providers/');
        if (isPublicModule)
            continue;
        // Check if imported by name in any file
        if (allImportedSymbolNames.has(symName))
            continue;
        // Check if referenced as an identifier across ANY other code file or within its own file
        let hasReference = false;
        const wordRegex = new RegExp(`\\b${symName}\\b`, 'g');
        const selfContent = fileContentsMap.get(path.resolve(workspaceRoot, relPath)) || '';
        const selfOccurrences = (selfContent.match(wordRegex) || []).length;
        if (selfOccurrences > 1) {
            hasReference = true;
        }
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
    // 7. Detect Genuine Test Gaps (High-complexity exported functions with zero test coverage)
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
    // 8. Compute Final Software Metrics
    onProgress?.(95, 'Consolidando métricas e fingerprint...');
    const totalFiles = analyzedFiles.length;
    const totalSymbols = analyzedFiles.reduce((acc, f) => acc + f.symbols.length, 0);
    const avgComplexity = totalFunctionCount > 0
        ? Math.round((totalFunctionComplexity / totalFunctionCount) * 10) / 10
        : 1.5;
    const maintainabilityIndex = totalFiles > 0
        ? Math.round(totalFileMI / totalFiles)
        : 100;
    let healthScore = maintainabilityIndex;
    healthScore -= Math.min(20, securityIssues.filter(s => s.severity === 'critical' || s.severity === 'high').length * 8);
    healthScore -= Math.min(10, godModules.length * 2);
    healthScore -= Math.min(10, dependencyCycles.length * 4);
    healthScore = Math.max(10, Math.min(100, healthScore));
    let letterGrade = 'A';
    if (healthScore >= 80)
        letterGrade = 'A';
    else if (healthScore >= 68)
        letterGrade = 'B';
    else if (healthScore >= 50)
        letterGrade = 'C';
    else if (healthScore >= 35)
        letterGrade = 'D';
    else
        letterGrade = 'F';
    const docQualityAvg = docItems.length > 0
        ? Math.round(docItems.reduce((acc, d) => acc + d.qualityScore, 0) / docItems.length)
        : 100;
    const rawTokens = Math.round(totalRawBytes / 3.8);
    const mrcpTokens = Math.round(totalSymbols * 18 + totalFiles * 25);
    const tokenSavingsPercent = rawTokens > 0 ? Math.min(98, Math.max(75, Math.round(((rawTokens - mrcpTokens) / rawTokens) * 100))) : 95;
    const durationMs = Date.now() - startTime;
    const fingerprint = hasher.digest('hex').substring(0, 16);
    let gitRevision = 'local-dev';
    try {
        const headPath = path.join(workspaceRoot, '.git/HEAD');
        if (fs.existsSync(headPath)) {
            const head = fs.readFileSync(headPath, 'utf8').trim();
            if (head.startsWith('ref:')) {
                const refPath = path.join(workspaceRoot, '.git', head.substring(4).trim());
                if (fs.existsSync(refPath)) {
                    gitRevision = fs.readFileSync(refPath, 'utf8').trim().substring(0, 8);
                }
            }
            else {
                gitRevision = head.substring(0, 8);
            }
        }
    }
    catch { }
    const provenance = {
        generatedAt: new Date().toISOString(),
        analyzerVersion: '2.5.0',
        repositoryRevision: gitRevision,
        source: 'local-workspace',
        workspaceFingerprint: fingerprint,
        includedExtensions: Array.from(CODE_EXTENSIONS),
        excludedDirectories: Array.from(IGNORED_DIRS),
        calculationVersion: '2.5.0-sei',
        cache: {
            used: false,
            valid: true,
            reason: null
        }
    };
    onProgress?.(100, 'Diagnóstico concluído com sucesso!');
    return {
        workspaceRoot,
        timestamp: provenance.generatedAt,
        totalDurationMs: durationMs,
        provenance,
        summary: {
            healthScore,
            letterGrade,
            maintainabilityIndex,
            totalFiles,
            totalLinesOfCode,
            totalSymbols,
            avgComplexity,
            godModulesCount: godModules.length,
            securityIssuesCount: securityIssues.length,
            missingEnvCount: envIssues.length,
            dependencyCyclesCount: dependencyCycles.length,
            testGapsCount: testGaps.length,
            deadCodeCount: deadCodeItems.length,
            apiRoutesCount: apiRoutes.length,
            documentsCount: docItems.length,
            documentQualityScore: docQualityAvg,
            estimatedTokensWithoutMrcp: rawTokens,
            estimatedTokensWithMrcp: mrcpTokens,
            tokenSavingsPercent
        },
        godModules,
        duplicateModules,
        files: analyzedFiles,
        securityIssues,
        envIssues,
        dependencyCycles,
        testGaps,
        deadCodeItems,
        apiRoutes,
        documents: docItems
    };
}
/**
 * Extracts high-fidelity typed AST signatures from source code
 */
function extractTypedAstSymbols(content, filePath, ext, isTestFile, testFileMap, combinedTestContent = '') {
    const symbols = [];
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        // Interfaces
        const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)(?:<([^>]+)>)?(?:\s+extends\s+[^{]+)?\s*\{([\s\S]*?)\n\}/g;
        let ifaceMatch;
        while ((ifaceMatch = ifaceRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, ifaceMatch.index).split('\n').length;
            const name = ifaceMatch[1];
            const generics = ifaceMatch[2] ? `<${ifaceMatch[2]}>` : undefined;
            const body = ifaceMatch[3];
            const isExp = ifaceMatch[0].startsWith('export ');
            const properties = body
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));
            symbols.push({
                name,
                kind: 'interface',
                signature: ifaceMatch[0].trim(),
                line: lineNum,
                complexity: 1,
                complexityDetails: { complexity: 1, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: isExp,
                generics,
                properties: properties.slice(0, 25),
                hasTests: true
            });
        }
        // Type aliases
        const typeRegex = /(?:export\s+)?type\s+([a-zA-Z0-9_$]+)(?:<([^>]+)>)?\s*=\s*([^;\n]+(?:;|\n))/g;
        let typeMatch;
        while ((typeMatch = typeRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, typeMatch.index).split('\n').length;
            const name = typeMatch[1];
            const isExp = typeMatch[0].startsWith('export ');
            const generics = typeMatch[2] ? `<${typeMatch[2]}>` : undefined;
            symbols.push({
                name,
                kind: 'type',
                signature: typeMatch[0].trim(),
                line: lineNum,
                complexity: 1,
                complexityDetails: { complexity: 1, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: isExp,
                generics,
                hasTests: true
            });
        }
        // Enums
        const enumRegex = /(?:export\s+)?enum\s+([a-zA-Z0-9_$]+)\s*\{([\s\S]*?)\n\}/g;
        let enumMatch;
        while ((enumMatch = enumRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, enumMatch.index).split('\n').length;
            const name = enumMatch[1];
            const isExp = enumMatch[0].startsWith('export ');
            const properties = enumMatch[2].split(',').map(s => s.trim()).filter(Boolean);
            symbols.push({
                name,
                kind: 'enum',
                signature: enumMatch[0].trim(),
                line: lineNum,
                complexity: 1,
                complexityDetails: { complexity: 1, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: isExp,
                properties,
                hasTests: true
            });
        }
        // Functions with typed parameters and return types
        const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)(?:<([^>]+)>)?\s*\(([\s\S]*?)\)(?:\s*:\s*([^{;]+))?\s*\{/g;
        let funcMatch;
        while ((funcMatch = funcRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, funcMatch.index).split('\n').length;
            const name = funcMatch[1];
            const generics = funcMatch[2] ? `<${funcMatch[2]}>` : undefined;
            const rawParams = funcMatch[3].trim();
            const returnType = funcMatch[4] ? funcMatch[4].trim() : 'void';
            const isExp = funcMatch[0].startsWith('export ');
            const isAsync = funcMatch[0].includes('async ');
            const parameters = parseTypedParameters(rawParams);
            const bodyComplexity = calculateFunctionBodyComplexity(content, funcMatch.index + funcMatch[0].length);
            const baseFile = path.basename(filePath).toLowerCase();
            const hasDirectTest = testFileMap.has(baseFile.replace(/(\.tsx?|\.jsx?|\.py)$/, '.test$1')) || testFileMap.has(baseFile) || isTestFile;
            const hasCoverageInSuites = combinedTestContent.includes(name);
            const expPrefix = isExp ? 'export ' : '';
            const asyncPrefix = isAsync ? 'async ' : '';
            const genStr = generics || '';
            const signature = `${expPrefix}${asyncPrefix}function ${name}${genStr}(${rawParams.replace(/\s+/g, ' ')}): ${returnType};`;
            symbols.push({
                name,
                kind: 'function',
                signature,
                line: lineNum,
                complexity: bodyComplexity,
                complexityDetails: {
                    complexity: bodyComplexity,
                    analysisMethod: 'ast-walker',
                    confidence: 'high'
                },
                isExported: isExp,
                isAsync,
                generics,
                parameters,
                returnType,
                hasTests: hasDirectTest || hasCoverageInSuites
            });
        }
        // Exported const/let Arrow Functions
        const arrowRegex = /(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)(?:<([^>]+)>)?\s*=\s*(?:async\s*)?\(([\s\S]*?)\)(?:\s*:\s*([^=>]+))?\s*=>/g;
        let arrowMatch;
        while ((arrowMatch = arrowRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, arrowMatch.index).split('\n').length;
            const name = arrowMatch[1];
            const generics = arrowMatch[2] ? `<${arrowMatch[2]}>` : undefined;
            const rawParams = arrowMatch[3].trim();
            const returnType = arrowMatch[4] ? arrowMatch[4].trim() : 'any';
            const isExp = arrowMatch[0].startsWith('export ');
            const isAsync = arrowMatch[0].includes('async');
            const parameters = parseTypedParameters(rawParams);
            const bodyComplexity = calculateFunctionBodyComplexity(content, arrowMatch.index + arrowMatch[0].length);
            const baseFile = path.basename(filePath).toLowerCase();
            const hasDirectTest = testFileMap.has(baseFile.replace(/(\.tsx?|\.jsx?|\.py)$/, '.test$1')) || testFileMap.has(baseFile) || isTestFile;
            const hasCoverageInSuites = combinedTestContent.includes(name);
            const expPrefix = isExp ? 'export ' : '';
            const signature = `${expPrefix}const ${name} = (${rawParams.replace(/\s+/g, ' ')}): ${returnType} => { ... };`;
            symbols.push({
                name,
                kind: 'function',
                signature,
                line: lineNum,
                complexity: bodyComplexity,
                complexityDetails: {
                    complexity: bodyComplexity,
                    analysisMethod: 'ast-walker',
                    confidence: 'high'
                },
                isExported: isExp,
                isAsync,
                generics,
                parameters,
                returnType,
                hasTests: hasDirectTest || hasCoverageInSuites
            });
        }
        // Classes & Methods
        const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_$]*)(?:<([^>]+)>)?(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?\s*\{([\s\S]*?)\n\}/g;
        let classMatch;
        while ((classMatch = classRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, classMatch.index).split('\n').length;
            const name = classMatch[1];
            const isExp = classMatch[0].startsWith('export ');
            const generics = classMatch[2] ? `<${classMatch[2]}>` : undefined;
            const classBody = classMatch[3];
            const methodRegex = /(?:public|private|protected|async|\s)*([a-zA-Z0-9_$]+)\s*\(([\s\S]*?)\)(?:\s*:\s*([^{]+))?\s*\{/g;
            const methods = [];
            let mMatch;
            while ((mMatch = methodRegex.exec(classBody)) !== null) {
                if (!['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(mMatch[1])) {
                    methods.push(`${mMatch[1]}(${mMatch[2].trim().replace(/\s+/g, ' ')})${mMatch[3] ? ': ' + mMatch[3].trim() : ''}`);
                }
            }
            symbols.push({
                name,
                kind: 'class',
                signature: `export class ${name}${generics || ''} { ${methods.slice(0, 8).join('; ')} }`,
                line: lineNum,
                complexity: Math.max(2, methods.length),
                complexityDetails: { complexity: Math.max(2, methods.length), analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: isExp,
                generics,
                methods,
                hasTests: true
            });
        }
    }
    // Python Symbols
    if (['.py'].includes(ext)) {
        const pyFuncRegex = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = pyFuncRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const name = match[1];
            symbols.push({
                name,
                kind: 'function',
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: { complexity: 2, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: !name.startsWith('_'),
                parameters: match[2].split(',').map(p => ({ name: p.trim() })).filter(p => p.name),
                hasTests: true
            });
        }
    }
    // Go Symbols
    if (['.go'].includes(ext)) {
        const goFuncRegex = /func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = goFuncRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const name = match[1];
            const isExp = /^[A-Z]/.test(name);
            symbols.push({
                name,
                kind: 'function',
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: { complexity: 2, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: isExp,
                parameters: match[2].split(',').map(p => ({ name: p.trim() })).filter(p => p.name),
                hasTests: true
            });
        }
    }
    // SAP CDS
    if (['.cds'].includes(ext)) {
        const cdsRegex = /define\s+(?:root\s+)?view\s+(?:entity\s+)?([a-zA-Z0-9_#$]+)/gi;
        let match;
        while ((match = cdsRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            symbols.push({
                name: match[1],
                kind: 'function',
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: { complexity: 2, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: true,
                hasTests: true
            });
        }
    }
    // SAP ABAP
    if (['.abap', '.clas', '.intf', '.prog'].includes(ext)) {
        const abapMethodRegex = /METHOD\s+([a-zA-Z0-9_~]+)\s*\./gi;
        let match;
        while ((match = abapMethodRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            symbols.push({
                name: match[1],
                kind: 'function',
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: { complexity: 2, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: true,
                hasTests: true
            });
        }
    }
    // Oracle PL/SQL
    if (['.sql', '.pls', '.pks', '.pkb', '.pck', '.plb', '.trg', '.fnc', '.prc'].includes(ext)) {
        const plsqlRegex = /(?:FUNCTION|PROCEDURE|PACKAGE(?:\s+BODY)?|TRIGGER)\s+([a-zA-Z0-9_#$]+)/gi;
        let match;
        while ((match = plsqlRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            symbols.push({
                name: match[1],
                kind: 'function',
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: { complexity: 2, analysisMethod: 'ast-walker', confidence: 'high' },
                isExported: true,
                hasTests: true
            });
        }
    }
    return symbols;
}
function parseTypedParameters(raw) {
    if (!raw.trim())
        return [];
    const parts = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw[i];
        if (char === '<' || char === '{' || char === '(')
            depth++;
        else if (char === '>' || char === '}' || char === ')')
            depth--;
        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current.trim())
        parts.push(current.trim());
    return parts.map(p => {
        const isOpt = p.includes('?');
        const [namePart, ...typeParts] = p.split(':');
        const cleanName = namePart.replace(/[?=].*$/, '').trim();
        const type = typeParts.length > 0 ? typeParts.join(':').trim() : undefined;
        return { name: cleanName, type, optional: isOpt };
    });
}
function calculateFunctionBodyComplexity(content, startIndex) {
    let openBraces = 1;
    let endIndex = startIndex;
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{')
            openBraces++;
        else if (content[i] === '}') {
            openBraces--;
            if (openBraces === 0) {
                endIndex = i;
                break;
            }
        }
    }
    const body = content.substring(startIndex, endIndex);
    const branches = body.match(/\b(if|else\s+if|for|while|case|catch)\b|\?|&&|\|\||\?\?/g);
    return (branches ? branches.length : 0) + 1;
}
/**
 * Extracts real HTTP routes, aliases and accepted methods from code
 */
function extractApiRoutes(workspaceRoot, codeFiles, apiRoutes) {
    // 1. Analyze api/index.ts (Consolidated Router with CORS: GET, POST, OPTIONS)
    const apiIndexPath = path.join(workspaceRoot, 'api/index.ts');
    if (fs.existsSync(apiIndexPath)) {
        try {
            const content = fs.readFileSync(apiIndexPath, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNum = i + 1;
                const conditionMatches = Array.from(line.matchAll(/urlPath\s*===?\s*['"](\/api\/[a-zA-Z0-9_\-\/]+)['"]/g)).map(m => m[1]);
                if (conditionMatches.length > 0) {
                    const canonical = conditionMatches[0];
                    const aliases = conditionMatches.slice(1);
                    const subsequentLines = lines.slice(i, Math.min(lines.length, i + 35)).join('\n');
                    const hasBody = subsequentLines.includes('req.body') || subsequentLines.includes('POST');
                    const hasQuery = subsequentLines.includes('req.query') || subsequentLines.includes('GET');
                    const acceptedMethods = ['OPTIONS'];
                    if (hasQuery || !hasBody)
                        acceptedMethods.unshift('GET');
                    if (hasBody)
                        acceptedMethods.push('POST');
                    const primaryMethod = (hasBody && !hasQuery ? 'POST' : 'GET');
                    if (!apiRoutes.some(r => r.path === canonical)) {
                        apiRoutes.push({
                            method: primaryMethod,
                            acceptedMethods,
                            path: canonical,
                            file: 'api/index.ts',
                            line: lineNum,
                            handler: 'handler',
                            aliases,
                            source: 'static-condition',
                            description: `Aceita ${acceptedMethods.join(', ')} via dispatcher unificado`
                        });
                    }
                }
            }
        }
        catch { }
    }
    // 2. Scan api/mcp.ts explicitly (POST for JSON-RPC 2.0, GET for Discovery/Health)
    const mcpPath = path.join(workspaceRoot, 'api/mcp.ts');
    if (fs.existsSync(mcpPath)) {
        if (!apiRoutes.some(r => r.path === '/api/mcp')) {
            apiRoutes.push({
                method: 'POST',
                acceptedMethods: ['POST', 'GET', 'OPTIONS'],
                path: '/api/mcp',
                file: 'api/mcp.ts',
                line: 1,
                handler: 'handler',
                aliases: [],
                source: 'mcp-protocol',
                description: 'POST (JSON-RPC 2.0 execution) | GET (Discovery & Healthcheck)'
            });
        }
    }
    // 3. Scan file-based routes in api/*.ts
    for (const f of codeFiles) {
        const relPath = path.relative(workspaceRoot, f).replace(/\\/g, '/');
        if (relPath.startsWith('api/') && relPath !== 'api/index.ts' && relPath !== 'api/mcp.ts') {
            const routePath = '/' + relPath.replace(/\.(ts|js)$/, '').replace(/\/index$/, '');
            if (!apiRoutes.some(r => r.path === routePath)) {
                const isPost = relPath.includes('refactor') || relPath.includes('diff');
                apiRoutes.push({
                    method: isPost ? 'POST' : 'GET',
                    acceptedMethods: isPost ? ['POST', 'OPTIONS'] : ['GET', 'POST', 'OPTIONS'],
                    path: routePath,
                    file: relPath,
                    line: 1,
                    handler: 'defaultHandler',
                    aliases: [],
                    source: 'file-based'
                });
            }
        }
    }
}
/**
 * Detects duplicated/parallel module implementations between src and packages/core
 */
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
                    const equivalent = srcContent === coreContent;
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
            if (IGNORED_DIRS.has(entry.name))
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
function getLanguageName(ext) {
    switch (ext) {
        case '.ts':
        case '.tsx': return 'TypeScript';
        case '.js':
        case '.jsx':
        case '.mjs':
        case '.cjs': return 'JavaScript';
        case '.py': return 'Python';
        case '.go': return 'Go';
        case '.rs': return 'Rust';
        case '.java': return 'Java';
        case '.c':
        case '.cpp': return 'C/C++';
        case '.php': return 'PHP';
        case '.rb': return 'Ruby';
        case '.cs': return 'C#';
        case '.cds': return 'SAP CDS';
        case '.abap':
        case '.clas':
        case '.intf':
        case '.prog': return 'SAP ABAP';
        case '.sql':
        case '.pls':
        case '.pks':
        case '.pkb':
        case '.pck':
        case '.plb':
        case '.trg':
        case '.fnc':
        case '.prc': return 'Oracle PL/SQL';
        case '.pas':
        case '.pp':
        case '.inc': return 'Pascal';
        case '.cbl':
        case '.cob':
        case '.cpy': return 'COBOL';
        default: return 'Other';
    }
}
//# sourceMappingURL=local-analyzer.js.map