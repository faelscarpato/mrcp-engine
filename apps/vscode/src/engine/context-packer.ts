import { MrcpSuiteResult, MrcpFileAnalysis, MrcpSymbol } from './types';

export function packWorkspaceContextForAi(result: MrcpSuiteResult): string {
  const { summary, provenance, duplicateModules, files, apiRoutes, envIssues, securityIssues } = result;

  const savingsTokens = Math.max(0, summary.estimatedTokensWithoutMrcp - summary.estimatedTokensWithMrcp);
  const estimatedCostSaved = ((savingsTokens / 1000) * 0.003).toFixed(2);

  const header = `<!-- 🚀 MRCP-ENGINE DETERMINISTIC CONTEXT PACK FOR AI AGENTS (${summary.tokenSavingsPercent}% TOKEN REDUCTION) -->
<!-- Generated at: ${provenance.generatedAt} | Revision: ${provenance.repositoryRevision} | Fingerprint: ${provenance.workspaceFingerprint} -->
<!-- Source: ${provenance.source} | Version: ${provenance.analyzerVersion} (Calc: ${provenance.calculationVersion}) -->
<!-- Cache: used=${provenance.cache.used}, valid=${provenance.cache.valid} | Health Score: ${summary.healthScore}/100 (Grade ${summary.letterGrade}) -->

## 📋 REPOSITORY ARCHITECTURAL CONTEXT & GROUND TRUTH

> [!TIP]
> 📊 **MRCP Token ROI & Efficiency Proof:**
> - **Tokens Brutos sem MRCP (Raw Baseline):** \`${summary.estimatedTokensWithoutMrcp.toLocaleString()} tokens\` (se a IA tivesse que ler arquivos brutos)
> - **Tokens Otimizados com MRCP (Context Pack):** \`${summary.estimatedTokensWithMrcp.toLocaleString()} tokens\` (extração AST determinística)
> - **Economia Real de Contexto:** \`~${savingsTokens.toLocaleString()} tokens (${summary.tokenSavingsPercent}% de redução)\`
> - **Custo Médio Economizado por Chamada:** \`~$${estimatedCostSaved} USD\`

- **Maintainability Index:** ${summary.maintainabilityIndex}/100 (Calculation: SEI Standard)
- **Total Analyzed Files:** ${summary.totalFiles} (${summary.totalLinesOfCode} lines of code)
- **Average Function Complexity:** ${summary.avgComplexity} (Ciclomática)
- **Token Efficiency:** ~${summary.tokenSavingsPercent}% reduction (${summary.estimatedTokensWithMrcp.toLocaleString()} vs ${summary.estimatedTokensWithoutMrcp.toLocaleString()} raw tokens)
- **Identified API Routes:** ${apiRoutes.length}
- **Security Findings:** ${securityIssues.length}
- **Missing .env Vars:** ${envIssues.length}
`;

  let dupSection = '';
  if (duplicateModules && duplicateModules.length > 0) {
    dupSection = `\n> [!WARNING]
> **Architectural Risk (Duplicate Implementations):** ${duplicateModules.length} parallel modules detected between \`src/\` and \`packages/core/\`.
${duplicateModules.map(d => `> - Primary: \`${d.primary}\` | Mirror: \`${d.duplicate}\` (Equivalent: ${d.contentEquivalent}, Risk: ${d.risk.toUpperCase()})`).join('\n')}
> *Recommendation: Reference and modify \`packages/core/\` as the canonical source.*\n\n---\n`;
  }

  let routesSection = '';
  if (apiRoutes.length > 0) {
    routesSection = `### 🌐 DETECTED API CONTRACTS & ROUTE ALIASES\n\`\`\`text\n`;
    for (const route of apiRoutes) {
      const aliasStr = route.aliases && route.aliases.length > 0 ? ` (Aliases: ${route.aliases.join(', ')})` : '';
      const methodStr = (route.method || 'GET').padEnd(6);
      routesSection += `${methodStr} ${route.path}${aliasStr} -> in ${route.file}:${route.line} [${route.source}]\n`;
    }
    routesSection += `\`\`\`\n\n---\n`;
  }

  let filesSection = `### 🧩 MODULES, TYPED EXPORTS & STRUCTURAL CONTRACTS\n\n`;
  for (const file of files.slice(0, 150)) {
    if (file.symbols.length === 0 && file.exports.length === 0) continue;
    filesSection += `#### 📁 \`${file.relativePath}\` (${file.language} | MI: ${file.complexity})\n`;
    if (file.imports.length > 0) {
      filesSection += `> Imports: ${file.imports.slice(0, 8).join(', ')}${file.imports.length > 8 ? ' ...' : ''}\n\n`;
    }
    filesSection += `\`\`\`typescript\n`;
    for (const sym of file.symbols) {
      filesSection += formatSymbolSignature(sym) + '\n';
    }
    filesSection += `\`\`\`\n\n`;
  }

  const guidelines = `\n---
## 🤖 OPERATIONAL INSTRUCTIONS FOR THE AI ASSISTANT
1. All signatures above are extracted directly from the current workspace AST with real parameter and return types.
2. **TOKEN EFFICIENCY REPORTING**: When reporting to the user, include the MRCP Token Efficiency Proof (~${summary.tokenSavingsPercent}% token reduction: ${summary.estimatedTokensWithMrcp.toLocaleString()} with MRCP vs ${summary.estimatedTokensWithoutMrcp.toLocaleString()} raw tokens).
3. Do NOT hallucinate methods, exports or types not present in these signatures.
4. Keep all edits strictly aligned with existing exports, conventions and contracts.
`;

  return header + dupSection + routesSection + filesSection + guidelines;
}

function formatSymbolSignature(sym: MrcpSymbol): string {
  // If signature was extracted cleanly, use it
  if (sym.signature && !sym.signature.includes('(...args: any[])')) {
    return `// complexity: ${sym.complexity} [${sym.complexityDetails.analysisMethod}]\n${sym.signature}`;
  }

  // Format by kind with real fields
  const exp = sym.isExported ? 'export ' : '';
  if (sym.kind === 'interface') {
    const props = sym.properties && sym.properties.length > 0
      ? '\n  ' + sym.properties.join('\n  ') + '\n'
      : ' /* no properties */ ';
    return `${exp}interface ${sym.name}${sym.generics || ''} {${props}}`;
  }

  if (sym.kind === 'type') {
    return `${exp}type ${sym.name}${sym.generics || ''} = /* defined type */;`;
  }

  if (sym.kind === 'enum') {
    const props = sym.properties && sym.properties.length > 0 ? sym.properties.join(', ') : '';
    return `${exp}enum ${sym.name} { ${props} }`;
  }

  if (sym.kind === 'class') {
    const methods = sym.methods && sym.methods.length > 0
      ? '\n  ' + sym.methods.join(';\n  ') + ';\n'
      : ' /* methods */ ';
    return `${exp}class ${sym.name}${sym.generics || ''} {${methods}}`;
  }

  if (sym.kind === 'function' || sym.kind === 'method') {
    const params = sym.parameters && sym.parameters.length > 0
      ? sym.parameters.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type || 'any'}`).join(', ')
      : '';
    const ret = sym.returnType ? `: ${sym.returnType}` : ': void';
    const asyncPrefix = sym.isAsync ? 'async ' : '';
    return `// complexity: ${sym.complexity}\n${exp}${asyncPrefix}function ${sym.name}${sym.generics || ''}(${params})${ret};`;
  }

  return `${exp}const ${sym.name}: any;`;
}

export function packSingleFileContext(file: MrcpFileAnalysis, content: string): string {
  return `<!-- 🚀 MRCP SINGLE FILE CONTEXT FOR AI -->
### File: \`${file.relativePath}\` (${file.language})
- Lines of Code: ${file.linesCount}
- Cyclomatic Complexity: ${file.complexity}
- Exported Symbols: ${file.exports.join(', ') || 'None'}
- Imports: ${file.imports.join(', ') || 'None'}

\`\`\`${file.language.toLowerCase()}
${content}
\`\`\`
`;
}
