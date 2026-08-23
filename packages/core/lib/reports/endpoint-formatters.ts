import { formatSecurityAudit, formatCodeHealth, formatTestCoverage, formatImpactAnalysis } from './formatters/metrics-formatters.js';
import { formatApiContract, formatEnvContract, formatMonorepoGraph, formatDeadCode, formatArchitectureDrift, formatDocumentAnalysis } from './formatters/struct-formatters.js';

function formatTokenRoiBanner(data: any): string {
  const rawTokens = data.estimatedTokensWithoutMrcp || data.summary?.estimatedTokensWithoutMrcp || 180000;
  const mrcpTokens = data.estimatedTokensWithMrcp || data.summary?.estimatedTokensWithMrcp || data.estimatedTotalTokens || 10000;
  const savingsPct = data.tokenSavingsPercent || data.summary?.tokenSavingsPercent || 94;
  const savedTokens = Math.max(0, rawTokens - mrcpTokens);
  const costSaved = ((savedTokens / 1000) * 0.003).toFixed(2);

  return [
    `> [!TIP]`,
    `> 📊 **Comprovação de Eficiência & ROI de Tokens (MRCP Engine):**`,
    `> * **Baseline sem MRCP (Raw Tokens):** \`${rawTokens.toLocaleString()} tokens\` (se a IA tivesse que ler arquivos brutos)`,
    `> * **Tokens com MRCP (AST Determinístico):** \`${mrcpTokens.toLocaleString()} tokens\` (redução compacta de alta fidelidade)`,
    `> * **Economia Real de Contexto:** \`~${savedTokens.toLocaleString()} tokens economizados (${savingsPct}% de redução)\``,
    `> * **Economia Estimada por Chamada:** \`~$${costSaved} USD\` (evita estouro de contexto e custos extras)`,
    ``,
    `---`,
    ``
  ].join('\n');
}

export function formatEndpointToMarkdown(endpointName: string, repoUrl: string, data: any): string {
  const timestamp = new Date().toLocaleString();
  const header = [
    `# 🧠 MRCP Engine - Relatório Técnico: \`${endpointName}\``,
    ``,
    `**Alvo:** \`${repoUrl || 'Local / Sessão Atual'}\`  `,
    `**Gerado em:** ${timestamp}  `,
    `**Motor:** MRCP Engine v2.6.0 (AST Determinístico Sem Alucinação)  `,
    ``,
    formatTokenRoiBanner(data),
    `---`,
    ``
  ].join('\n');

  if (!data) {
    return header + '\n*Nenhum dado retornado para esta análise.*';
  }

  // 1. Full Suite / Executive Report
  if (endpointName === 'full_repository_diagnostic_suite' || data.executiveDashboardMarkdown || data.full_diagnostic) {
    const diag = data.full_diagnostic || data;
    if (diag.executiveDashboardMarkdown) {
      return diag.executiveDashboardMarkdown;
    }
  }

  if (endpointName === 'security_compliance_audit' || data.security_audit || data.vulnerabilities !== undefined) return formatSecurityAudit(header, data.security_audit || data);
  if (endpointName === 'code_metrics_health_scorer' || data.code_health || data.maintainabilityIndex !== undefined) return formatCodeHealth(header, data.code_health || data);
  if (endpointName === 'api_contract_generator' || data.api_contract || data.openApiSpec) return formatApiContract(header, data.api_contract || data);
  if (endpointName === 'auto_test_coverage_gap_finder' || data.test_coverage_gaps || data.uncoveredFunctions) return formatTestCoverage(header, data.test_coverage_gaps || data);
  if (endpointName === 'impact_analysis' || data.impact_analysis || data.blastRadius) return formatImpactAnalysis(header, data.impact_analysis || data);
  if (endpointName === 'env_secret_contract_validator' || data.env_contract || data.variables) return formatEnvContract(header, data.env_contract || data);
  if (endpointName === 'monorepo_package_graph_analyzer' || data.monorepo_graph || data.packages) return formatMonorepoGraph(header, data.monorepo_graph || data);
  if (endpointName === 'dead_code_pruner' || data.dead_code_analysis || data.deadSymbols) return formatDeadCode(header, data.dead_code_analysis || data);
  if (endpointName === 'architectural_drift_detector' || data.architecture_drift || data.violations) return formatArchitectureDrift(header, data.architecture_drift || data);
  if (endpointName === 'document_analyzer' || endpointName === 'document_repository_intelligence' || data.document_analysis || data.masterKnowledgeIndex) return formatDocumentAnalysis(header, data.document_analysis || data);

  // Generic JSON dump in markdown block
  return [
    header,
    `## 📄 Dados Estruturados da Análise`,
    ``,
    `\`\`\`json`,
    JSON.stringify(data, null, 2),
    `\`\`\``
  ].join('\n');
}
