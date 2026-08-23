"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractEnterpriseSymbols = extractEnterpriseSymbols;
function extractEnterpriseSymbols(content, ext) {
    const symbols = [];
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
//# sourceMappingURL=ast-enterprise.js.map