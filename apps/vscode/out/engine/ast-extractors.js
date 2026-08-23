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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTypedAstSymbols = extractTypedAstSymbols;
const path = __importStar(require("path"));
__exportStar(require("./ast-helpers"), exports);
const ast_helpers_1 = require("./ast-helpers");
const ast_enterprise_1 = require("./ast-enterprise");
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
            const parameters = (0, ast_helpers_1.parseTypedParameters)(rawParams);
            const bodyComplexity = (0, ast_helpers_1.calculateFunctionBodyComplexity)(content, funcMatch.index + funcMatch[0].length);
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
            const parameters = (0, ast_helpers_1.parseTypedParameters)(rawParams);
            const bodyComplexity = (0, ast_helpers_1.calculateFunctionBodyComplexity)(content, arrowMatch.index + arrowMatch[0].length);
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
    symbols.push(...(0, ast_enterprise_1.extractEnterpriseSymbols)(content, ext));
    return symbols;
}
//# sourceMappingURL=ast-extractors.js.map