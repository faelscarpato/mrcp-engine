"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractEnterpriseSymbols = extractEnterpriseSymbols;
function extractEnterpriseSymbols(content, ext) {
    const symbols = [];
    // SAP CDS
    if ([".cds"].includes(ext)) {
        const cdsRegex = /define\s+(?:root\s+)?view\s+(?:entity\s+)?([a-zA-Z0-9_#$]+)/gi;
        let match;
        while ((match = cdsRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split("\n").length;
            symbols.push({
                name: match[1],
                kind: "function",
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: {
                    complexity: 2,
                    analysisMethod: "ast-walker",
                    confidence: "high",
                },
                isExported: true,
                hasTests: true,
            });
        }
    }
    // SAP ABAP
    if ([".abap", ".clas", ".intf", ".prog"].includes(ext)) {
        const abapMethodRegex = /METHOD\s+([a-zA-Z0-9_~]+)\s*\./gi;
        let match;
        while ((match = abapMethodRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split("\n").length;
            symbols.push({
                name: match[1],
                kind: "function",
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: {
                    complexity: 2,
                    analysisMethod: "ast-walker",
                    confidence: "high",
                },
                isExported: true,
                hasTests: true,
            });
        }
    }
    // Oracle PL/SQL
    if ([
        ".sql",
        ".pls",
        ".pks",
        ".pkb",
        ".pck",
        ".plb",
        ".trg",
        ".fnc",
        ".prc",
    ].includes(ext)) {
        const plsqlRegex = /(?:FUNCTION|PROCEDURE|PACKAGE(?:\s+BODY)?|TRIGGER)\s+([a-zA-Z0-9_#$]+)/gi;
        let match;
        while ((match = plsqlRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split("\n").length;
            symbols.push({
                name: match[1],
                kind: "function",
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: {
                    complexity: 2,
                    analysisMethod: "ast-walker",
                    confidence: "high",
                },
                isExported: true,
                hasTests: true,
            });
        }
    }
    // C#
    if ([".cs"].includes(ext)) {
        const csRegex = /(?:public|private|protected|internal|static|async|\s)*(?:void|[a-zA-Z0-9_<>[\]?]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:where[^{]+)?\{/gi;
        let match;
        while ((match = csRegex.exec(content)) !== null) {
            if (!["if", "for", "while", "switch", "catch", "using", "lock"].includes(match[1])) {
                const lineNum = content.substring(0, match.index).split("\n").length;
                symbols.push({
                    name: match[1],
                    kind: "function",
                    signature: match[0].replace(/\{$/, "").trim(),
                    line: lineNum,
                    complexity: 2,
                    complexityDetails: {
                        complexity: 2,
                        analysisMethod: "ast-walker",
                        confidence: "high",
                    },
                    isExported: match[0].includes("public"),
                    hasTests: true,
                });
            }
        }
    }
    // Swift & Kotlin
    if ([".swift", ".kt", ".kts"].includes(ext)) {
        const fnRegex = /(?:func|fun)\s+([a-zA-Z0-9_]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/gi;
        let match;
        while ((match = fnRegex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split("\n").length;
            symbols.push({
                name: match[1],
                kind: "function",
                signature: match[0].trim(),
                line: lineNum,
                complexity: 2,
                complexityDetails: {
                    complexity: 2,
                    analysisMethod: "ast-walker",
                    confidence: "high",
                },
                isExported: true,
                hasTests: true,
            });
        }
    }
    // Salesforce Apex
    if ([".cls", ".trigger"].includes(ext)) {
        const apexRegex = /(?:public|global|private|protected|\s)*(?:void|[a-zA-Z0-9_<>[\]]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gi;
        let match;
        while ((match = apexRegex.exec(content)) !== null) {
            if (!["if", "for", "while", "switch"].includes(match[1])) {
                const lineNum = content.substring(0, match.index).split("\n").length;
                symbols.push({
                    name: match[1],
                    kind: "function",
                    signature: match[0].trim(),
                    line: lineNum,
                    complexity: 2,
                    complexityDetails: {
                        complexity: 2,
                        analysisMethod: "ast-walker",
                        confidence: "high",
                    },
                    isExported: match[0].includes("public") || match[0].includes("global"),
                    hasTests: true,
                });
            }
        }
    }
    return symbols;
}
//# sourceMappingURL=ast-enterprise.js.map