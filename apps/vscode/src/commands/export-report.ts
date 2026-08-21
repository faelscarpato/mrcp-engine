import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CommandContext } from './run-suite';

export async function exportReportCommand(ctx: CommandContext): Promise<void> {
  let result = ctx.getLastResult();
  if (!result) {
    result = await vscode.commands.executeCommand('mrcp.runFullSuite');
  }

  if (!result) return;

  const { summary, godModules, duplicateModules, securityIssues, envIssues, dependencyCycles, testGaps, deadCodeItems, apiRoutes, documents, provenance } = result;

  const md = `# 🛡️ MRCP Engine — Relatório Diagnóstico do Workspace

- **Data do Diagnóstico:** ${result.timestamp}
- **Workspace:** \`${result.workspaceRoot}\`
- **Revisão Git:** \`${provenance.repositoryRevision}\` (Fingerprint: \`${provenance.workspaceFingerprint}\`)
- **Tempo de Execução:** ${result.totalDurationMs}ms
- **Nota Geral:** **${summary.letterGrade}** (${summary.healthScore}/100)
- **Índice de Manutenibilidade:** ${summary.maintainabilityIndex}/100 (Cálculo SEI Standard)
- **Economia Estimada de Tokens LLM:** ~${summary.tokenSavingsPercent}% (${summary.estimatedTokensWithMrcp} vs ${summary.estimatedTokensWithoutMrcp} tokens)

---

## 📊 1. Resumo Executivo das Métricas

| Métrica | Valor | Avaliação |
|---|---|---|
| **Arquivos Analisados** | ${summary.totalFiles} | ${summary.totalLinesOfCode} linhas de código |
| **Símbolos Extraídos** | ${summary.totalSymbols} | Funções, classes, interfaces (AST tipado) |
| **Complexidade Média** | ${summary.avgComplexity} | Ciclomática por função |
| **God Modules** | ${summary.godModulesCount} | Arquivos monolíticos com alta complexidade/LOC |
| **Vulnerabilidades de Segurança** | ${summary.securityIssuesCount} | Falhas / Segredos expostos |
| **Variáveis Ausentes (.env)** | ${summary.missingEnvCount} | Inconsistências de ambiente |
| **Ciclos de Dependência** | ${summary.dependencyCyclesCount} | Arquitetura |
| **Gaps de Testes Unitários** | ${summary.testGapsCount} | Funções de alta complexidade sem cobertura detectada |
| **Código Morto (Dead Code)** | ${summary.deadCodeCount} | Exports internos sem import ou referência cruzada |
| **Documentos Indexados (DQI)** | ${summary.documentsCount} | Qualidade Média: ${summary.documentQualityScore}/100 |

---

## 🛡️ 2. Auditoria de Segurança & Segredos

${securityIssues.length === 0 && envIssues.length === 0 ? '✅ **Nenhuma vulnerabilidade detectável pelas regras atuais** (Zero falhas detectadas pelos padrões estáticos de regex e segredos).' : ''}

${securityIssues.map(s => `* **[${s.severity.toUpperCase()}] ${s.rule}**: \`${s.file}:${s.line}\` - ${s.message}`).join('\n')}
${envIssues.map(e => `* **[ENV_MISSING]**: Variável \`process.env.${e.variableName}\` usada em \`${e.file}:${e.line}\` mas não declarada no \`.env\``).join('\n')}

---

## 🏛️ 3. Módulos Monolíticos (God Modules) & Arquitetura

${godModules.length === 0 ? '_Nenhum God Module detectado._' : ''}
${godModules.map(g => `* 📁 \`${g.file}\` (${g.linesCount} linhas | Complexidade: ${g.complexity})\n  > **Diagnóstico:** ${g.reason}`).join('\n\n')}

${duplicateModules && duplicateModules.length > 0 ? `\n### ⚠️ Risco Arquitetural: Implementações Paralelas (\`src/\` vs \`packages/core/\`)\n` + duplicateModules.map(d => `* **Principal:** \`${d.primary}\` | **Espelho:** \`${d.duplicate}\` (Equivalente: ${d.contentEquivalent}, Risco: ${d.risk.toUpperCase()})`).join('\n') : ''}

---

## 🌐 4. Contratos de API & Métodos HTTP Detectados

${apiRoutes.length === 0 ? '_Nenhuma rota REST/RPC detectada explicitamente._' : ''}
${apiRoutes.map(a => {
  const aliasText = a.aliases && a.aliases.length > 0 ? ` *(Aliases: ${a.aliases.join(', ')})*` : '';
  const methodsText = a.acceptedMethods ? `[${a.acceptedMethods.join(', ')}]` : `[${a.method}]`;
  const desc = a.description ? `\n  > ${a.description}` : '';
  return `* \`${methodsText.padEnd(20)}\` \`${a.path}\`${aliasText} (em \`${a.file}:${a.line}\`)${desc}`;
}).join('\n')}

---

## 🧪 5. Gaps de Testes & Código Morto

${deadCodeItems.length === 0 ? '* ✅ **Código Morto:** Nenhum export zumbi encontrado.' : deadCodeItems.map(d => `* **Código Morto**: Símbolo \`${d.symbolName}\` (${d.kind}) em \`${d.file}:${d.line}\` - ${d.reason || 'Sem referência'}.`).join('\n')}

${testGaps.length === 0 ? '* ✅ **Cobertura:** Nenhuma função de alta complexidade sem teste detectada.' : testGaps.map(g => `* **Gap de Teste**: Função \`${g.functionName}()\` (Complexidade: ${g.complexity}) em \`${g.file}:${g.line}\` sem teste unitário correspondente.`).join('\n')}

---
*Gerado deterministicamente por MRCP-Engine v2.5.0 (Fingerprint: ${provenance.workspaceFingerprint})*
`;

  const reportPath = path.join(result.workspaceRoot, 'MRCP_DIAGNOSTIC_REPORT.md');
  fs.writeFileSync(reportPath, md, 'utf8');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath));
  await vscode.window.showTextDocument(doc, { preview: false });

  vscode.window.showInformationMessage(`📄 Relatório diagnóstico gerado em: MRCP_DIAGNOSTIC_REPORT.md`);
}
